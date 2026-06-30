import * as vscode from 'vscode';
import Handlebars from "handlebars";
import { Module } from '../module';
import { LuaFunctionSection, LuaClassDefinition, LuaFunction } from './lua-class-definition';
import { TextUtils } from '../utils/text-utils';
import { LuaClass } from '../lua-import-manager/importables/lua-class';
import { LuaImportableCache } from '../lua-import-manager/importable-class-cache';
import { CppClassCache } from './cpp-class-cache';
import { ConfigUtils } from '../utils/config-utils';
import { FileUtils } from '../utils/file-utils';
import { LuaImportManager } from '../lua-import-manager/import-manager';
import { LuaGenerationUtils } from './lua-generation-utils';
import { WindowUtils } from '../utils/window-utils';
import { CppClassTranslator } from './cpp-class-translator';

export class LuaClassCreation implements Module {

    /** The postfix ending for Lua class names when referring to the class's static components */
    private static staticClassPostfix = "Class";

    /** The postfix ending for Lua class names when referring to the class's instanced components */
    private static instanceClassPostfix = "Instance";

    /** The prefix start for RobustClass instanced class names */
    private static robustClassPrefix = "Renegade_";

    /** The directory where template files should be, relative to the project's root */
    private static templateBasePath = "./templates";

    private static template: HandlebarsTemplateDelegate;
    private static cppWorkspaceFolderName: string | undefined;
    private static luaWorkspaceFolderName: string | undefined;

    public static initialize( context: vscode.ExtensionContext ){
        CppClassCache.initialize( context );

        // Create Lua Class from JSON Class Definition
        const createClassFromJsonDisposable = vscode.commands.registerCommand(
            "renegade-toolkit.createLuaFromJson",
            async () => {
                const editor = vscode.window.activeTextEditor;
                if( editor === undefined ) { return; }
                
                const documentLanguage = editor.document.languageId;
                if( documentLanguage !== "json" ) { return; }

                const classDefinition = LuaClassDefinition.deserializeFromJsonUri( editor.document.uri );

                const createdClass = await this.createClass( classDefinition );

                WindowUtils.showFile( createdClass );
            }
        );

        // Create JSON Class Definition from Header
        const createClassFromHeaderDisposable = vscode.commands.registerCommand(
            "renegade-toolkit.createJsonFromHeader",
            async () => {
                const editor = vscode.window.activeTextEditor;
                if( editor === undefined ) { return; }
                if( editor.document.languageId !== "cpp" ) { return; }

                // Get a list of the classes the file contains
                const classesInFile = CppClassCache.getClassesByUri( editor.document.uri );
                if( classesInFile.length === 0 ){
                    vscode.window.showErrorMessage( "There are no classes in this file!" );
                    return;
                }

                // Determine which class within the header file is being created
                let classToCreate: string | undefined;
                if( classesInFile.length === 1 ){
                    // If there's only one class in the header file, don't bother asking
                    classToCreate = classesInFile[0].name;
                }else{
                    // Create a list of class names within the file
                    const classNames = [];
                    for (let classIndex = 0; classIndex < classesInFile.length; classIndex++) {
                        const classOption = classesInFile[classIndex];
                        classNames.push( classOption.name );
                    }
            
                    // Prompt the user to pick one of the class names
                    classToCreate = await vscode.window.showQuickPick( classNames, { title: "Select Class to Create", canPickMany: false, ignoreFocusOut: true } );
                }
                if( classToCreate === undefined ){
                    vscode.window.showErrorMessage( "Canceling class creation" );
                    return;
                }

                // Create a C++ class definition
                const cppClassDefinition = await CppClassTranslator.createCppClassDefinition( editor.document, classToCreate );
                if( cppClassDefinition === undefined ){
                    vscode.window.showErrorMessage( `Failed to create C++ class definition for ${classToCreate}` );
                    return;
                }

                // Convert C++ class definition to Lua class definition
                const luaClassDefinition = LuaClassDefinition.fromCppClassDefinition( cppClassDefinition );

                // Create the file path where the class definition file should be saved
                const rootSavePath = FileUtils.relativeLuaWorkspacePathToUri( ConfigUtils.GetLuaClassDefinitionRootPath() );

                const relativeCppClassFilePath = FileUtils.uriToRelativeCppWorkspacePath( editor.document.uri );
                const cppClassPath = this.createCppClassPath( luaClassDefinition.CppName, relativeCppClassFilePath );
                const luaclassPath = cppClassPath.substring( 0, cppClassPath.lastIndexOf( "/" ) + 1 ).toLowerCase();
                
                const fileName = luaClassDefinition.FileName + ".class.json";

                const savePath = vscode.Uri.joinPath( rootSavePath, luaclassPath, fileName );

                await FileUtils.write( savePath, luaClassDefinition.serializeToJson() );

                WindowUtils.showFile( savePath );
            }
        );

        context.subscriptions.push( createClassFromHeaderDisposable, createClassFromJsonDisposable );    
    }

    private static async loadTemplate(){
        const classTemplatePath = vscode.Uri.joinPath(
            FileUtils.getLuaWorkspaceFolder().uri,
            ConfigUtils.GetLuaClassTemplateFilePath()
        );

        const classTemplateContents = await FileUtils.read( classTemplatePath );
        this.template = Handlebars.compile( classTemplateContents );
    }

    /**
     * @param cppFile The CPP file that the class is being created based on
     */
    public static async createClass( classDefinition: LuaClassDefinition ) : Promise<vscode.Uri> {
        await this.loadTemplate();

        const templateInput: any = {};

        const baseName = this.createBaseName( classDefinition.Name );
        const parents = this.getParentClasses( classDefinition.ParentNames );

        const staticClassName = baseName + this.staticClassPostfix;
        const instanceClassName = baseName + this.instanceClassPostfix;
        const robustClassName = this.robustClassPrefix + baseName;

        templateInput.BaseClassName = baseName;
        templateInput.StaticClassName = staticClassName;
        templateInput.InstanceClassName = instanceClassName;
        templateInput.RobustClassName = robustClassName;

    // #region "Based On" header comment
        const cppClassName = classDefinition.CppName;
        templateInput.CppClassName = cppClassName,
        templateInput.CppFilePath = classDefinition.CppPath;
    // #endregion
        

    // #region Parents
        // Multiline import statements for the parent(s) of the class (if any)
        let parentImportsString = LuaImportManager.createClassImportsString( parents );
        if( parentImportsString.length !== 0 ){
            parentImportsString = "\n" + parentImportsString;
        }

        // Parent classes for the static LuaLS @class defintion
        let luaLanguageServerStaticParents = "";

        // Parent classes for the instance LuaLS @class defintion
        let luaLanguageServerInstanceParents = "";

        // Parameters to CNC.CreateExport to establish inheritance
        let createExportParentsString = "";

        // Part of the robustclass.Register input string to establish inheritance
        let robustClassParentsString = "";

        if( parents.length !== 0 ){
            luaLanguageServerStaticParents = " : ";
            luaLanguageServerInstanceParents = " : ";
            robustClassParentsString = " : ";

            for (let parentIndex = 0; parentIndex < parents.length; parentIndex++) {
                const parent = parents[parentIndex];
                
                luaLanguageServerStaticParents += parent.getStaticName();
                luaLanguageServerInstanceParents += parent.getInstanceName();
                createExportParentsString += parent.getVariableName();
                robustClassParentsString += parent.getRobustClassName();

                if( parentIndex !== parents.length - 1 ){
                    luaLanguageServerStaticParents += ", ";
                    luaLanguageServerInstanceParents += ", ";
                    createExportParentsString += ", ";
                    robustClassParentsString += ", ";
                }
            }
            createExportParentsString = " " + createExportParentsString +  " ";
        }

        templateInput.ParentImports = parentImportsString;
        templateInput.CreateExportParents = createExportParentsString;
        templateInput.LuaLanguageServerStaticParents = luaLanguageServerStaticParents;
        templateInput.LuaLanguageServerInstanceParents = luaLanguageServerInstanceParents;
        templateInput.RobustClassParents = robustClassParentsString;
    // #endregion


    // #region Imports
        // Multiline import statements for all imported classes
        // Currently a placeholder for later expansion
        let classImportsString = "";
        let enumImportsString = "";

        templateInput.ClassImports = classImportsString;
        templateInput.EnumImports = enumImportsString;
    // #endregion

    // #region Instance
        if( classDefinition.Instance !== undefined ){
            // Fields
            let instanceFieldsString = LuaGenerationUtils.createFields( classDefinition.Instance.Fields );
            if( instanceFieldsString.length !== 0 ){
                instanceFieldsString += "\n";
            }

            // Functions
            let instanceFunctionsString = this.createInstanceFunctions( classDefinition.Instance.Functions, robustClassName );

            templateInput.InstanceFields = instanceFieldsString;
            templateInput.InstanceFunctions = instanceFunctionsString;
        }
        templateInput.IsStaticOnly = templateInput.InstanceFields === undefined;
    // #endregion

    // #region Static

        const indentStatics = !templateInput.IsStaticOnly;

        // Fields
        const staticFields = classDefinition.Static.Fields;
        let staticFieldsString = LuaGenerationUtils.createFields( staticFields );
        if( staticFields.length !== 0 ){
            if( indentStatics ){
                staticFieldsString = TextUtils.indentAll( staticFieldsString, 2 );
            }
            staticFieldsString += "\n";
        }

        // Functions
        const staticFunctions = classDefinition.Static.Functions;
        let staticFunctionsString = this.createStaticFunctions( staticFunctions );
        if( indentStatics && staticFunctions.length !== 0 ){
            staticFunctionsString = TextUtils.indentAll( staticFunctionsString );
        }

        templateInput.StaticFields = staticFieldsString;
        templateInput.StaticFunctions = staticFunctionsString;
    // #endregion

        // Create the class contents
        const classContent = this.template( templateInput );

        // Save the content to its file
        let luaFilePath = this.createLuaPath( classDefinition.CppName, classDefinition.CppPath, classDefinition.FileName );
        await FileUtils.write( luaFilePath, classContent );

        return luaFilePath;
    }

// #region Class Component Generators

    private static createStaticFunctions( functions: (LuaFunction|LuaFunctionSection)[] ) : string {
        let results = "";

        const functionCount = functions.length;
        if( functionCount === 0 ){ 
            return results;
        }

        // We need an empty line between typecheck registration and the first static function
        results = "\n" + LuaGenerationUtils.createStaticFunctions( functions );
        
        return results;
    }

    private static createInstanceFunctions( functions: (LuaFunction|LuaFunctionSection)[], constructorName: string ) : string {
        let results = "";

        const functionCount = functions.length;
        if( functionCount === 0 ){ 
            return results;
        }

        // Swap the constructor name in for the "Constructor" function name
        functions = this.replaceConstructorDestructor( functions, constructorName );

        // We need an empty line between typecheck registration and the first static function
        results = "\n" + LuaGenerationUtils.createInstanceFunctions( functions );
        
        return results;
    }

    /**
     * Finds any instance of a function called "Constructor" and "Destructor" and replaces them using the provided RobustClass name
     */
    private static replaceConstructorDestructor( functions: (LuaFunction|LuaFunctionSection)[], robustClassName: string ) :  (LuaFunction|LuaFunctionSection)[] {
        for (let functionIndex = 0; functionIndex < functions.length; functionIndex++) {
            const entry = functions[functionIndex];

            // Function name
            if( (entry as LuaFunction).params !== undefined ){
                const luaFunction = (entry as LuaFunction);

                // Swap the "Constructor" entry for the constructor name
                if( luaFunction.name.toLowerCase() === "constructor" ){
                    luaFunction.name = robustClassName;
                    functions[functionIndex] = luaFunction;
                }

                // Swap the "Destructor" entry for the destructor name
                if( luaFunction.name.toLowerCase() === "destructor" ){
                    luaFunction.name = "_" + robustClassName;
                    functions[functionIndex] = luaFunction;
                }

            // Sections
            }else if( (entry as LuaFunctionSection).Functions !== undefined ){
                const luaFunctionSection = (entry as LuaFunctionSection);
                luaFunctionSection.Functions = this.replaceConstructorDestructor( luaFunctionSection.Functions, robustClassName );
            }else{
                throw new Error( `Function entry ${functionIndex} was neither a string nor an object` );
            }
        }

        return functions;
    }

// #endregion


// #region Names

    /**
     * @returns The input name without instance, static, or Robustclass identifiers.
     */
    private static createBaseName( name: string ): string {
        let baseName = name;

        // In case the base name was a static or instanced class name
        baseName = TextUtils.removeEndings( name, [ "Class", "Instance" ] );

        // In case the base name was somehow a RobustClass name
        baseName = TextUtils.removeBeginnings( name, [ "Renegade_" ] );

        return baseName;
    }

    private static getParentClasses( parentNames: string[] ){
        const classes: LuaClass[] = [];

        for (let classNameIndex = 0; classNameIndex < parentNames.length; classNameIndex++) {
            const parentClassName = parentNames[classNameIndex];

            const fuzzyResults = LuaImportableCache.findLuaClassesByName( parentClassName );
            if( fuzzyResults.length === 0 ){
                throw new Error( `Unable to find parent Lua class '${parentClassName}'` );
            }

            // We can't import multiple classes for a single parent so just use the first one
            // This isn't a perfect solution but then I'm not a perfect programmer
            const parentClass = fuzzyResults[0];

            classes.push( parentClass );
        }

        return classes;
    }

// #endregion


// #region Paths

    private static createLuaPath( cppClassName: string, relativeCppClassFilePath: string, luaFileName: string ): vscode.Uri {
        // Start with the CPP path
        let path = this.createCppClassPath( cppClassName, relativeCppClassFilePath );

        // Lua paths are all lowercase
        path = path.toLowerCase();

        // Remove the file name and extension
        const lastSlashIndex = path.lastIndexOf( "/" );
        path = path.substring( 0, lastSlashIndex );

        // Add the Lua file name
        path = `${path}/${luaFileName}.lua`;

        // Add the addon path portion
        path = `lua/renegade/${path}`;

        return FileUtils.relativeLuaWorkspacePathToUri( path );
    }

    /**
     * @param cppClassFile The file that contains the class
     */
    public static createCppClassPath( cppClassName: string, relativeCppClassFilePath: string ) : string {
        const relativePath = vscode.workspace.asRelativePath( relativeCppClassFilePath );

        // Remove any workspace folder names from the start of the path
        const classPath = TextUtils.removeBeginnings(
            relativePath,
            [
                "/",
                ConfigUtils.GetCppWorkspaceFolderName(),
                ConfigUtils.GetLuaWorkspaceFolderName()
            ]
        );

        return classPath;
    }
// #endregion
}