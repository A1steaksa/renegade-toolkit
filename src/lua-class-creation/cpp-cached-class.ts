import * as vscode from 'vscode';

export class CppCachedClass {
    constructor(
        public name: string,
        public files: vscode.Uri[]
    ){}

    public equals( otherClass: CppCachedClass ) : boolean {
        return this.name.toLowerCase() === otherClass.name.toLowerCase();
    }
}