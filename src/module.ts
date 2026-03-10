import * as vscode from 'vscode';

export abstract class Module {

    /** Should set up the module within VSCode */
    public static initialize( context: vscode.ExtensionContext ){}
}