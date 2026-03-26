import * as vscode from 'vscode';

export type FunctionSection = { Title: string, Functions: (string|FunctionSection)[] };

/**
 * Stores a class definition file's contents after they have been loaded JSON
 */
export class LuaClassDefinition {

    public static fromJson( json: string ): LuaClassDefinition {
        return JSON.parse( json ) as LuaClassDefinition;
    }

    private constructor(
        public Name: string,
        public ParentNames: string[],
        public FileName: string,
        public CppName: string,

        public Static: {
            Fields: string[],
            Functions: (string|FunctionSection)[]
        },

        public Instance: {
            Fields: string[],
            Functions: (string|FunctionSection)[]
        }
    ){}
}