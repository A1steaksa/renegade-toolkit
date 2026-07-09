import * as vscode from 'vscode';
import { FileUtils } from '../utils/file-utils';
import { ConfigUtils } from '../utils/config-utils';
import { CppClassDefinition } from './cpp-class-definition';

/**
 * The schema of the Lua class definition JSON
 */
export class JsonClassDefinition {

    /**
     * Convert a CPP class definition into a Json class definition
     */
    public static from( cppClassDefinition: CppClassDefinition ): JsonClassDefinition {
        
    }

    /**
     * Reads a `.class.json` Lua class definition file
     * @return The parsed Lua class definition file
     */
    public static async read( uri: vscode.Uri ) : Promise<JsonClassDefinition> {
        const fileContents = await FileUtils.read( uri );
        return JSON.parse( fileContents ) as JsonClassDefinition;
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

    private constructor(
        public Name: string,
        public ParentNames: string[],
        public FileName: string,
        public CppName: string,
        public CppPath: string,
        public Static: JsonClassRealm,
        public Instance: JsonClassRealm
    ){}
}

class JsonClassRealm {
    private constructor(
        public Fields: JsonField[],
        public Functions: JsonFunction[] 
    ){}
}

class JsonField {
    private constructor(
        public Name: string,
        public DataType: string,
        public ArrayDepth: number
    ){}
}

class JsonFunction {
    private constructor(
        public Name: string,
        public Arguments: JsonField[],
        public Return: JsonField
    ){}
}