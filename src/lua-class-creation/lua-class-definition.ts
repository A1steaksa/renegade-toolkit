import * as vscode from 'vscode';
import fs from 'fs';
import { TextUtils } from '../utils/text-utils';
import { CppClassDefinition, CppClassParentDefinition, CppFieldDefinition, CppFunctionDefinition } from './cpp-class-translator';
import { FileUtils } from '../utils/file-utils';

export class LuaClassRealm { 
    constructor( public Fields: LuaField[], public Functions: ( LuaFunction | LuaFunctionSection )[] ){
    }
}

export class LuaFunctionSection {
    constructor( public Title: string, public Functions: ( LuaFunction | LuaFunctionSection )[] ){
    }
};

export class LuaField {
    constructor( public name: string, public dataType: string = "any" ) {
    }

    public toJSON(): Object {
        return this.name;
    }

    public getFieldString(): string {
        return `--- @field ${this.name} ${this.dataType}`;
    }

    public getParameterString(): string {
        return `--- @param ${this.name} ${this.dataType}`;
    }
}

export class LuaFunction {
    constructor( public name: string, public returnType: string | undefined = undefined, public params: LuaField[] = [] ) {
    }

    public toJSON(): Object {
        return this.name;
    }

    private getHeaderCommentString(): string {
        let result = "";

        // Parameters
        for( let paramIndex = 0; paramIndex < this.params.length; paramIndex++ ) {
            const arg = this.params[paramIndex];
            result += arg.getParameterString();
        }

        // Return type
        if( this.returnType !== undefined && this.returnType.length !== 0 ) {
            result += `--- @return ${this.returnType}`;
        }

        return result;
    }

    public getStaticString(): string {
        const indent = TextUtils.getIndent( 1 );

        let result = "";
        result += this.getHeaderCommentString();
        result += `function STATIC.${this.name}()\n`;
        result += `${indent}typecheck.NotImplementedError()\n`;
        result += `end\n`;
        return result;
    }

    public getInstanceString(): string {
        const indent = TextUtils.getIndent( 1 );

        let result = "";
        result += this.getHeaderCommentString();
        result += `function INSTANCE:${this.name}()\n`;
        result += `${indent}typecheck.NotImplementedError()\n`;
        result += `end\n`;
        return result;
    }
}

export class LuaEnumDefinition {
    constructor( public name: string ){  }

    public getDeclarationString(): string {
        let result = "";
        result += ``;
        return result;
    }
}

/**
 * Stores a class definition file's contents after they have been loaded JSON
 */
export class LuaClassDefinition {

    // #region | Constructors

    private constructor(
        public Name: string,
        public ParentNames: string[],
        public FileName: string,
        public CppName: string,
        public CppPath: string,
        public Static: LuaClassRealm,
        public Instance: LuaClassRealm
    ) { }

    public static deserializeFromJsonUri( uri: vscode.Uri ): LuaClassDefinition {
        const rawJson = fs.readFileSync( uri.fsPath ).toString();
        const parsedJson = JSON.parse( rawJson );

        const parentNames = parsedJson.ParentNames === undefined ? [] : parsedJson.ParentNames;

        let definition = {
            Name: parsedJson.Name,
            ParentNames: parentNames,
            CppName: parsedJson.CppName,
            CppPath: parsedJson.CppPath
        } as LuaClassDefinition;

        // Use the JSON file name if none was provided explicitly
        if( parsedJson.FileName === undefined ) {
            let fileName = uri.path;
            fileName = fileName.substring(
                fileName.lastIndexOf( "/" ),
                fileName.indexOf( "." )
            );

            definition.FileName = fileName;
        } else {
            definition.FileName = parsedJson.FileName;
        }

        // Enums
        if( parsedJson.Enums !== undefined ){
            const luaEnums = [];
            for( let enumIndex = 0; enumIndex < parsedJson.Enums.length; enumIndex++ ){
                const enumName = parsedJson.Enums[enumIndex];

                luaEnums.push( new LuaEnumDefinition( enumName ) );
            }
        }

        // Static
        if( parsedJson.Static !== undefined ) {
            // Fields
            const jsonFields = parsedJson.Static.Fields;
            const luaFields = [];
            if( jsonFields !== undefined ) {
                for( let fieldIndex = 0; fieldIndex < jsonFields.length; fieldIndex++ ) {
                    const fieldName = jsonFields[fieldIndex];
                    const luaField = new LuaField( fieldName );
                    luaFields.push( luaField );
                }
            }

            definition.Static = {
                Fields: luaFields,
                Functions: this.createLuaFunctionsFromJson( parsedJson.Static.Functions )
            };

        } else {
            definition.Static = {
                Fields: [],
                Functions: []
            };
        }


        // Instance
        if( parsedJson.Instance !== undefined ) {
            // Fields
            const jsonFields = parsedJson.Instance.Fields;
            const luaFields = [];
            if( jsonFields !== undefined ) {
                for( let fieldIndex = 0; fieldIndex < jsonFields.length; fieldIndex++ ) {
                    const fieldName = jsonFields[fieldIndex];
                    const luaField = new LuaField( fieldName );
                    luaFields.push( luaField );
                }
            }

            definition.Instance = {
                Fields: luaFields,
                Functions: this.createLuaFunctionsFromJson( parsedJson.Instance.Functions )
            };
        }

        return definition;
    }

    public static fromCppClassDefinition( cppClassdefinition: CppClassDefinition ) : LuaClassDefinition {
        const cppClassName = cppClassdefinition.name;
        const luaClassName = this.cppClassNameToLua( cppClassName );
        const fileName = this.cppClassNameToLuaFileName( cppClassName );
        const parents = this.createLuaParentNames( cppClassdefinition.parents );

        const staticFields: LuaField[] = this.createLuaFields( cppClassdefinition.staticFields );
        const staticFunctions: LuaFunction[] = this.createLuaFunctions( luaClassName, cppClassdefinition.staticFunctions );
        const staticRealm = new LuaClassRealm( staticFields, staticFunctions );

        const instanceFields: LuaField[] = this.createLuaFields( cppClassdefinition.instanceFields );
        const instanceFunctions: LuaFunction[] = this.createLuaFunctions( luaClassName, cppClassdefinition.instanceFunctions );
        const instanceRealm = new LuaClassRealm( instanceFields, instanceFunctions );

        const cppPath = FileUtils.uriToRelativeCppWorkspacePath( cppClassdefinition.headerPath );

        return new LuaClassDefinition( luaClassName, parents, fileName, cppClassName, cppPath, staticRealm, instanceRealm );
    }
    // #endregion

    public serializeToJson(): string {
        return JSON.stringify( this, undefined, 2 );
    }

    // #region | Accessors

    public isStaticClass(): boolean {
        return this.Instance === undefined;
    }
    // #endregion

    // #region | Creators

    private static createLuaParentNames( parents: CppClassParentDefinition[] ) : string[] {
        const luaParents: string[] = [];

        for (let parentIndex = 0; parentIndex < parents.length; parentIndex++) {
            const parent = parents[parentIndex];
            luaParents.push( this.cppClassNameToLua( parent.name ) );
        }

        return luaParents;
    }

    private static createLuaFields( fields: CppFieldDefinition[] ): LuaField[] {
        const luaFields: LuaField[] = [];

        for (let fieldIndex = 0; fieldIndex < fields.length; fieldIndex++) {
            const field = fields[fieldIndex];
            
            // TODO: Convert C++ field types to Lua types

            const fieldName = this.cppFieldNameToLua( field.name );

            luaFields.push( new LuaField( fieldName ) );
        }

        return luaFields;
    }

    private static createLuaFunctions( className: string, functions: CppFunctionDefinition[] ): LuaFunction[] {
        const luaFunctions: LuaFunction[] = [];

        for (let functionIndex = 0; functionIndex < functions.length; functionIndex++) {
            const func = functions[functionIndex];

            // Remove any duplicates of this function from the rest of the list
            for (let duplicateIndex = functionIndex + 1; duplicateIndex < functions.length; duplicateIndex++) {
                const possibleDuplicateFunction = functions[duplicateIndex];
                if( func.name === possibleDuplicateFunction.name ){
                    functions.splice( duplicateIndex, 1 );
                }
            }

            // TODO: Convert C++ function return and argument types to Lua types

            let functionName = this.cppFunctionNameToLua( func.name );

            luaFunctions.push( new LuaFunction( functionName ) );
        }

        return luaFunctions;
    }

    private static createLuaFunctionsFromJson( jsonFunctions: any ): ( LuaFunction | LuaFunctionSection )[] {
        const results: ( LuaFunction | LuaFunctionSection )[] = [];

        for( let functionIndex = 0; functionIndex < jsonFunctions.length; functionIndex++ ) {
            const jsonFunction = jsonFunctions[functionIndex];

            if( typeof jsonFunction === "string" ) {
                const luaFunctionName = jsonFunction as string;

                results.push( new LuaFunction( luaFunctionName ) );
            } else if( jsonFunction as LuaFunctionSection ) {
                const luaFunctionSection = jsonFunction as LuaFunctionSection;

                const sectionFunctions = this.createLuaFunctionsFromJson( luaFunctionSection.Functions );


                results.push( { Title: luaFunctionSection.Title, Functions: sectionFunctions } as LuaFunctionSection );
            }
        }

        return results;
    }
    // #endregion

    // #region | Formatters



        public static cppClassNameToLuaFileName( cppClassName: string ): string {
            let adjustedName = TextUtils.removeEndings( cppClassName, ["Class"] );

            const originalWords = TextUtils.splitCamelCase( adjustedName );
            const expandedWords = TextUtils.expandWords( originalWords );
                        
            let luaFileName = expandedWords.join( "-" ).toLowerCase();
            
            return luaFileName;
        }

        private static cppClassNameToLua( cppClassName: string ): string {
            let luaClassName = TextUtils.removeEndings( cppClassName, ["Class"] );

            const originalWords = TextUtils.splitCamelCase( luaClassName );
            const expandedWords = TextUtils.expandWords( originalWords );

            luaClassName = expandedWords.join( "" );

            return luaClassName;
        }

        private static cppFieldNameToLua( cppFieldName: string ): string {
            return TextUtils.cppNameToLua( cppFieldName );
        }

        private static cppFunctionNameToLua( cppFunctionName: string ): string {
            return TextUtils.cppNameToLua( cppFunctionName );
        }
    // #endregion
}