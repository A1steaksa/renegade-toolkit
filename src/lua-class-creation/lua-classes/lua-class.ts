import * as vscode from 'vscode';
import { TextUtils } from "../../utils/text-utils";
import { CppClass, CppRealm } from "../cpp-classes/cpp-class";
import { FileUtils } from '../../utils/file-utils';
import { ConfigUtils } from '../../utils/config-utils';
import { LuaField } from './lua-field';
import { LuaFunction } from './lua-function';

/**
 * The schema of the Lua class
 */
export class LuaClass {

    private constructor(
        public Name: string,
        public ParentNames: string[],
        public FileName: string,
        public CppName: string,
        public CppPath: string,
        public Static: LuaRealm,
        public Instance: LuaRealm
    ){}

    /**
     * Convert a CPP class definition into a Lua class definition
     */
    public static fromCpp( cppClass: CppClass ): LuaClass {
        let luaClassName = TextUtils.cppNameToLua( cppClass.Name );
        let fileName = this.luaClassNameToFileName( luaClassName );

        // Parents
        let luaParentNames: string[] = [];
        if( cppClass.Parents !== undefined ){
            for( let key in cppClass.Parents ){
                let parent = cppClass.Parents[key];
                TextUtils.cppNameToLua( parent.DataType.Name );
            }
        }

        const staticRealm = LuaRealm.fromCpp( cppClass.Static );
        const instanceRealm = LuaRealm.fromCpp( cppClass.Instance );

        let jsonClass = new LuaClass( luaClassName, luaParentNames, fileName, cppClass.Name, cppClass.HeaderPath, staticRealm, instanceRealm );
        
        console.log( `${cppClass.Name} => ${luaClassName}`, jsonClass );

        return jsonClass;
    }

    /**
     * Reads a `.class.json` Lua class definition file
     * @return The parsed Lua class definition file
     */
    public static async read( uri: vscode.Uri ) : Promise<LuaClass> {
        const fileContents = await FileUtils.read( uri );
        return JSON.parse( fileContents ) as LuaClass;
    }

    /**
     * Write a `.class.json` Lua class definition file
     * @param savePath (Optional) Omit to have the file path determined automatically.
     * @return The file path where the file was saved.  Will be the same as `savePath` if that parameter is provided.
    */
    public async write( savePath: vscode.Uri|undefined ): Promise<vscode.Uri> {
        const jsonString = JSON.stringify( this, undefined, 2 );

        // Create the save path if one wasn't provided
        if( savePath === undefined ){
            const rootSavePath = FileUtils.relativeLuaWorkspacePathToUri( ConfigUtils.GetLuaClassDefinitionRootPath() );
            const fileName = this.FileName + ConfigUtils.GetJsonClassDefinitionFileExtension();
            savePath = vscode.Uri.joinPath( rootSavePath, fileName );
        }

        await FileUtils.write( savePath, jsonString );

        return savePath;
    }

    /**
     * Converts a Lua class name to an appropriate file name for it
     */
    public static luaClassNameToFileName( luaClassName: string ): string {
        let tokens = TextUtils.splitName( luaClassName );

        // Lowercase everything
        for( let key in tokens ){
            tokens[key] = tokens[key].toLowerCase();
        }

        return tokens.join( "-" );
    }
}


export class LuaRealm {
    private constructor(
        public Fields: LuaField[],
        public Functions: LuaFunction[] 
    ){}

    public static fromCpp( cppRealm: CppRealm ): LuaRealm {

        // Fields
        const fields: LuaField[] = [];
        for( let fieldIndex = 0; fieldIndex < cppRealm.Fields.length; fieldIndex++ ){
            const cppField = cppRealm.Fields[fieldIndex];
            fields.push( LuaField.fromCpp( cppField ) );
        }

        // Functions
        const functions: LuaFunction[] = [];
        for( let functionIndex = 0; functionIndex < cppRealm.Functions.length; functionIndex++ ){
            const cppFunc = cppRealm.Functions[functionIndex];
            functions.push( LuaFunction.fromCpp( cppFunc ) );
        }

        return new LuaRealm( fields, functions );
    }
}