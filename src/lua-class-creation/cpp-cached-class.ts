import * as vscode from 'vscode';

export class CppCachedClass {
    constructor(
        public name: string,
        public headerFile: vscode.Uri | undefined,
        public cppFile: vscode.Uri | undefined
    ){}

    public equals( otherClass: CppCachedClass ) : boolean {
        return this.name === otherClass.name;
    }
}