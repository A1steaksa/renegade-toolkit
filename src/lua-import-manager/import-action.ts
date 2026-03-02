
import * as vscode from 'vscode';
import { LuaImportCache } from './import-cache';
    
export class LuaImportAction implements vscode.CodeActionProvider {

    private static luaGlobalVariableNamePattern = /\`\w+\`/gm;

    provideCodeActions( document: vscode.TextDocument, range: vscode.Range | vscode.Selection, context: vscode.CodeActionContext, token: vscode.CancellationToken ): vscode.ProviderResult<( vscode.CodeAction | vscode.Command )[]> {
        let missingVariableName = this.getMissingVariableName( context );
        if( missingVariableName === undefined ){
            return;
        }

        // Ensure the first variable character is capitalized so it matches Lua class names
        missingVariableName = missingVariableName.substring( 0, 1 ).toUpperCase() + missingVariableName.substring( 1 );

        // Check if the missing variable matches an importable
        const importableForVariable = LuaImportCache.getImportableByClassName( missingVariableName );
        if( importableForVariable === undefined ){
            return;
        }

        const handlers: vscode.Command[] = [ {
            title: "Import " + importableForVariable.className + " from " + importableForVariable.importPath + "?" ,
            command: "renegade-toolkit.addImport",
            arguments: [
                document,
                importableForVariable
            ]
        } ];
        return handlers;
    }

    private getMissingVariableName( context: vscode.CodeActionContext ): string | undefined {
        let result: string | undefined;
        context.diagnostics.forEach( ( diagnostic ) => {
            if( diagnostic.message.includes( "Undefined global" ) ) {

                // Find the name of the variable that doesn't exist
                const variableNameMatches = diagnostic.message.match( LuaImportAction.luaGlobalVariableNamePattern );
                if( variableNameMatches === null ) {
                    return;
                }
                const variableName = variableNameMatches[0].replaceAll( "`", "" ).trim();

                result = variableName;
            }
        } );

        return result;
    }
}
