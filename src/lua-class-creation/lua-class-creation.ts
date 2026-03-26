import * as vscode from 'vscode';
import fs from 'fs';
import Handlebars from "handlebars";
import { Module } from '../module';
import { FunctionSection, LuaClassDefinition } from './lua-class-definition';
import { TextUtils } from '../utils/text-utils';
import { LuaClass } from '../lua-import-manager/importables/lua-class';
import { LuaImportableCache } from '../lua-import-manager/importable-class-cache';
import { CppClassCache } from './cpp-class-cache';
import { ConfigUtils } from '../utils/config-utils';
import { FileUtils } from '../utils/file-utils';
import { LuaImportManager } from '../lua-import-manager/import-manager';
import { LuaGenerationUtils } from './lua-generation-utils';
import { WindowUtils } from '../utils/window-utils';

export class LuaClassCreation implements Module {

    /** The filename of the Handlebars template file */
    protected templateFileName = "class-template.handlebars";

    /** The postfix ending for Lua class names when referring to the class's static components */
    private static staticClassPostfix = "Class";

    /** The postfix ending for Lua class names when referring to the class's instanced components */
    private static instanceClassPostfix = "Instance";

    /** The prefix start for RobustClass instanced class names */
    private static robustClassPrefix = "Renegade_";

    /** The directory where template files should be, relative to the project's root */
    private static templateBasePath = "./templates";

    /** The filename of the Handlebars template file */
    private static templateFileName = "class-template.handlebars";

    private static template: HandlebarsTemplateDelegate;
    private static cppWorkspaceFolderName: string | undefined;
    private static luaWorkspaceFolderName: string | undefined;


    public static initialize( context: vscode.ExtensionContext ){
        CppClassCache.initialize( context );

        // Create Class from JSON
        const createClassFromJsonDisposable = vscode.commands.registerCommand(
            "renegade-toolkit.createClassFromJson",
            async () => {
                const editor = vscode.window.activeTextEditor;
                if( editor === undefined ) {
                    return;
                }
                
                const documentLanguage = editor.document.languageId;
                if( documentLanguage !== "json" ) {
                    return;
                }

                const rawJson = fs.readFileSync( editor.document.uri.fsPath ).toString();

                const classDefinition = LuaClassDefinition.fromJson( rawJson );

                const createdClass = await this.createClass( classDefinition );

                WindowUtils.showFile( createdClass );
            }
        );

        context.subscriptions.push( createClassFromJsonDisposable );    
    }

    private static async loadTemplate(){
        const classTemplatePath = vscode.Uri.joinPath(
            FileUtils.getLuaWorkspaceFolder().uri,
            this.templateBasePath,
            this.templateFileName
        );

        const classTemplateContents = await FileUtils.read( classTemplatePath );
        this.template = Handlebars.compile( classTemplateContents );
    }

    public static async createClass( classDefinition: LuaClassDefinition ) : Promise<vscode.Uri> {
        await this.loadTemplate();

        const baseName = this.createBaseName( classDefinition.Name );
        const parents = this.getParentClasses( classDefinition.ParentNames );

        const staticClassName = baseName + this.staticClassPostfix;
        const instanceClassName = baseName + this.instanceClassPostfix;
        const robustClassName = this.robustClassPrefix + baseName;

        let luaFilePath = this.createLuaPath( classDefinition.CppName, classDefinition.FileName );

        console.log( staticClassName, instanceClassName, robustClassName );
        
        console.log( "Parent Classes:" );
        parents.forEach( parentClass => {
            console.log( `    ${parentClass.getStaticName()}` );
        });

        console.log( `Lua File Path: '${luaFilePath}'` );
        
        console.log( "Static Fields:" );
        classDefinition.Static.Fields.forEach( field => {
            console.log( `    ${field}` );
        });

        console.log( "Static Functions:" );
        classDefinition.Static.Functions.forEach( func => {
            console.log( `    ${func}` );
        });

        if( classDefinition.Instance !== undefined ){    
            console.log( "Instance Fields:" );
            classDefinition.Instance.Fields.forEach( field => {
                console.log( `    ${field}` );
            });

            console.log( "Instance Functions:" );
            classDefinition.Instance.Functions.forEach( func => {
                console.log( `    ${func}` );
            });
        }

    // #region "Based On" header comment

        const cppClassName = classDefinition.CppName;
        const cppClass = CppClassCache.getClassByName( cppClassName );
        if( cppClass === undefined ){
            throw new Error( `CPP Class Cache does not contain class '${cppClassName}'` );
        }
        
        let cppFilePath;
        if( cppClass.headerFile !== undefined ){
            cppFilePath = FileUtils.uriToRelativeCppWorkspacePath( cppClass.headerFile );
        }else if( cppClass.cppFile !== undefined ){
            cppFilePath = FileUtils.uriToRelativeCppWorkspacePath( cppClass.cppFile );
        }else{
            throw new Error( `Found CPP Class Cache entry for class '${cppClassName}' but it has neither a header nor cpp file` );
        }
    // #endregion
        

    // #region Parents

        // Multiline import statements for the parent(s) of the class (if any)
        const parentImportsString = LuaImportManager.createClassImportsString( parents );

        // Parent classes for the static LuaLS @class defintion
        let luaLanguageServerStaticParents = "";

        // Parent classes for the instance LuaLS @class defintion
        let luaLanguageServerInstanceParents = "";

        // Parameters to CNC.CreateExport to establish inheritance to
        let createExportParentsString = "";

        if( parents.length !== 0 ){
            luaLanguageServerStaticParents = " : ";
            luaLanguageServerInstanceParents = " : ";

            for (let parentIndex = 0; parentIndex < parents.length; parentIndex++) {
                const parent = parents[parentIndex];
                
                luaLanguageServerStaticParents += parent.getStaticName();
                luaLanguageServerInstanceParents += parent.getInstanceName();
                createExportParentsString += parent.getVariableName();

                if( parentIndex !== parents.length - 1 ){
                    luaLanguageServerStaticParents += ", ";
                    luaLanguageServerInstanceParents += ", ";
                    createExportParentsString += ", ";
                }
            }
            createExportParentsString = " " + createExportParentsString +  " ";
        }
    // #endregion


    // #region Imports
        // Multiline import statements for all imported classes
        // Currently a placeholder for later expansion
        let classImportsString = "";
        let enumImportsString = "";
    // #endregion


    // #region Static

        // Fields
        let staticFieldsString = "";
        const staticFieldCount = classDefinition.Static.Fields.length;
        for (let staticFieldIndex = 0; staticFieldIndex < staticFieldCount; staticFieldIndex++) {
            const field = classDefinition.Static.Fields[staticFieldIndex];
            staticFieldsString += LuaGenerationUtils.createField( field );
            if( staticFieldIndex !== staticFieldCount - 1 ){
                staticFieldsString += "\n";
            }
        }
        if( staticFieldsString.length !== 0 ){
            staticFieldsString = TextUtils.indentAll( staticFieldsString );
        }

        // Functions
        let staticFunctionsString = this.createStaticFunctions( classDefinition.Static.Functions );
    // #endregion


    // #region Instance

        // Fields
        let instanceFieldsString = "";
        const instanceFieldCount = classDefinition.Instance.Fields.length;
        for (let instanceFieldIndex = 0; instanceFieldIndex < instanceFieldCount; instanceFieldIndex++) {
            const field = classDefinition.Instance.Fields[instanceFieldIndex];
            instanceFieldsString += LuaGenerationUtils.createField( field );
            if( instanceFieldIndex !== instanceFieldCount - 1 ){
                instanceFieldsString += "\n";
            }
        }

        // Functions
        let instanceFunctionsString = this.createInstanceFunctions( classDefinition.Instance.Functions, robustClassName );
    // #endregion

        const templateInput = {
            // "Based On" header comment
            CppClassName: cppClassName,
            CppFilePath: cppFilePath,

            // Parents
            ParentImports: parentImportsString,
            CreateExportParents: createExportParentsString,
            LuaLanguageServerStaticParents: luaLanguageServerStaticParents,
            LuaLanguageServerInstanceParents: luaLanguageServerInstanceParents,

            // Imports
            ClassImports: classImportsString,
            EnumImports: enumImportsString,

            // Class Names
            BaseClassName: baseName,
            StaticClassName: staticClassName,
            InstanceClassName: instanceClassName,
            RobustClassName: robustClassName,

            // Static
            StaticFields: staticFieldsString,
            StaticFunctions: staticFunctionsString,

            // Instance
            InstanceFields: instanceFieldsString,
            InstanceFunctions: instanceFunctionsString,
        };

        // Create the class contents
        const classContent = this.template( templateInput );

        // Save the content to its file
        await FileUtils.write( luaFilePath, classContent );

        return luaFilePath;
    }

// #region Class Component Generators

    private static createStaticFunctions( functions: (string|FunctionSection)[] ) : string {
        let results = "";

        const functionCount = functions.length;
        if( functionCount === 0 ){ 
            return results;
        }

        // We need an empty line between typecheck registration and the first static function
        results = "\n" + this.createStaticFunctions( functions );

        results = TextUtils.indentAll( results );
        
        return results;
    }

    private static createInstanceFunctions( functions: (string|FunctionSection)[], constructorName: string ) : string {
        let results = "";

        const functionCount = functions.length;
        if( functionCount === 0 ){ 
            return results;
        }

        // Swap the constructor name in for the "Constructor" function name
        functions = this.replaceConstructor( functions, constructorName );

        // We need an empty line between typecheck registration and the first static function
        results = "\n" + LuaGenerationUtils.createInstanceFunctions( functions );
        
        return results;
    }

    /**
     * Finds any instance of a function called "Constructor" and replaces it with the provided constructor name
     */
    private static replaceConstructor( functions: (string|FunctionSection)[], constructorName: string ) :  (string|FunctionSection)[] {
        for (let functionIndex = 0; functionIndex < functions.length; functionIndex++) {
            const entry = functions[functionIndex];
            
            // Function name
            if( typeof entry === "string" ){
                // Swap the "Constructor" entry for the constructor name
                if( entry === "Constructor" ){
                    functions[functionIndex] = constructorName;
                    return functions;
                }

            // Sections
            }else if( entry as FunctionSection ){
                entry.Functions = this.replaceConstructor( entry.Functions, constructorName );

            }else{
                throw new Error( `Function entry ${functionIndex} was neither a string nor an object` );
            }
        }

        return functions;
    }

// #endregion


// #region Accessors

    private static getCppWorkspaceFolderName(): string {
        if( this.cppWorkspaceFolderName === undefined ){
            this.cppWorkspaceFolderName = ConfigUtils.getString( "CppWorkspaceFolderName" );
        }

        return this.cppWorkspaceFolderName;
    }

    private static getLuaWorkspaceFolderName(): string {
        if( this.luaWorkspaceFolderName === undefined ){
            this.luaWorkspaceFolderName = ConfigUtils.getString( "LuaWorkspaceFolderName" );
        }

        return this.luaWorkspaceFolderName;
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

    private static createLuaPath( cppClassName: string, luaFileName: string ): vscode.Uri {
        // Start with the CPP path
        let path = this.createCppClassPath( cppClassName );

        // Lua paths are all lowercase
        path = path.toLowerCase();

        // Remove the file name and extension
        const lastSlashIndex = path.lastIndexOf( "/" );
        path = path.substring( 0, lastSlashIndex );

        // Add the Lua file name
        path = `${path}/${luaFileName}.lua`;

        return FileUtils.relativeLuaWorkspacePathToUri( path );
    }

    private static createCppClassPath( cppClassName: string ) : string {
        const cppClass = CppClassCache.getClassByName( cppClassName );
        if( cppClass === undefined ){
            throw new Error( `Unable to find C++ class '${cppClassName}'`  );
        }

        let file = cppClass.headerFile;
        if( file === undefined ){
            file = cppClass.cppFile;

            if( file === undefined ){
                throw new Error( `Class '${cppClassName}' has cache entry but neither a header nor cpp file` );
            }
        }

        const relativePath = vscode.workspace.asRelativePath( file );

        // Remove any workspace folder names from the start of the path
        const classPath = TextUtils.removeBeginnings(
            relativePath,
            [
                "/",
                this.getCppWorkspaceFolderName(),
                this.getLuaWorkspaceFolderName()
            ]
        );

        return classPath;
    }
// #endregion
}