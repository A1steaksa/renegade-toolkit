import * as vscode from 'vscode';
import { Module } from '../module';
import { WindowUtils } from '../utils/window-utils';

export class FunctionLinks implements Module {
    
    public static initialize( context: vscode.ExtensionContext ){

        vscode.commands.registerCommand( "renegade-toolkit.jumpToCppFunction", async ( uri, line ) => {
            console.log( "Trying to jump to CPP function", uri, line );
        } );

        vscode.languages.registerCodeLensProvider( { language: "lua" }, new LuaFunctionLinker() );
        vscode.languages.registerCodeLensProvider( { language: "cpp" }, new CppFunctionLinker() );
    }
}

class CppFunctionLinker implements vscode.CodeLensProvider {
    private static functionPattern = /2/i;

    provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.ProviderResult<vscode.CodeLens[]> {
        const lenses: vscode.CodeLens[] = [];

        

        return lenses;
    }
}

class LuaFunctionLinker implements vscode.CodeLensProvider {

    private static functionPattern = /function (?:INSTANCE:|STATIC.)\s*([A-Za-z0-9_]+)\(/i;

    provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.ProviderResult<vscode.CodeLens[]> {
        
        const lenses: vscode.CodeLens[] = [];

        for( let lineNumber = 1; lineNumber < document.lineCount; lineNumber++ ){
            const line = document.getText( new vscode.Range( lineNumber, 0, lineNumber, 9999999 ) );

            const results = LuaFunctionLinker.functionPattern.exec( line );

            if( results ){

                const functionName = results[1];
                
                lenses.push( new vscode.CodeLens(
                    new vscode.Range( lineNumber, 0, lineNumber, line.length ),
                    {
                        title: "Jump to Original Function",
                        command: "renegade-toolkit.jumpToCppFunction",
                        arguments: [ document.uri, functionName ]
                    }
                ) );
            }
        }

        return lenses;
    }
}