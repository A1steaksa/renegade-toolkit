import Module from 'module';
import * as vscode from 'vscode';
import fs from 'fs';
import { CreateClassCommand } from './create-class';

export class CodeGen extends Module {

    static initialize( context: vscode.ExtensionContext ){
        /// Create Class
        const createClassDisposable = vscode.commands.registerCommand(
            "renegade-toolkit.createClass",
            async () => {
                const command = new CreateClassCommand();

                await command.runCommand();
            }
        );
        context.subscriptions.push( createClassDisposable );

        /// Create Class from JSON
        const createClassFromJsonDisposable = vscode.commands.registerCommand(
            "renegade-toolkit.createClassFromJson",
            async () => {

                let saveLocation: vscode.Uri | undefined;

                // Assume that triggering the command with a JSON file open 
                // means we want to use that JSON file as the input
                const editor = vscode.window.activeTextEditor;
                if( editor !== undefined ) {
                    const documentLanguage = editor.document.languageId;
                    if( documentLanguage === "json" ) {
                        saveLocation = editor.document.uri;
                    }
                }

                // Otherwise, prompt the user to select a JSON file to open
                if( saveLocation === undefined ) {
                    const classDefinitionFilePaths = await vscode.window.showOpenDialog( {
                        canSelectFiles: true,
                        canSelectMany: false,
                        filters: {
                            "JSON": ["json"],
                        },
                        openLabel: "Open Class Definition",
                        title: "Select Class Definition JSON"
                    } );

                    if( classDefinitionFilePaths === undefined ) {
                        vscode.window.showInformationMessage( "Class creation aborted" );
                        return;
                    }

                    saveLocation = classDefinitionFilePaths[0];
                }

                if( saveLocation === undefined ) {
                    vscode.window.showInformationMessage( "Class creation aborted" );
                    return;
                }

                const classDefinition = fs.readFileSync( saveLocation.fsPath ).toString();
                const classDefinitionObject = JSON.parse( classDefinition );

                const command = new CreateClassCommand();

                await command.runCommandSkipWizard( classDefinitionObject );
            }
        );
        context.subscriptions.push( createClassFromJsonDisposable );
    }

}