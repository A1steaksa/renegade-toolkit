
import * as vscode from 'vscode';
import { Module } from '../module';
import { LuaImportable } from './import-cache';
import { LuaImportAction } from './import-action';
import { LuaImportScanner } from './import-scanner';

export class LuaImportManager extends Module {

    private static importRegionStartPattern = /--+\s*#region\s*Imports/gm;

    public static override initialize( context: vscode.ExtensionContext, config: vscode.WorkspaceConfiguration ) {

        LuaImportScanner.initialize( context, config );
        
        // Add our code action provider for adding a Lua import
        vscode.languages.registerCodeActionsProvider( [ "lua" ], new LuaImportAction() );

        /// Add the command for adding an import
        const addImportDisposable = vscode.commands.registerCommand(
            "renegade-toolkit.addImport",
            ( document, importable ) => {
                LuaImportManager.addImport( document, importable );
            }
        );
        context.subscriptions.push( addImportDisposable );
    }


    public static addImport( document: vscode.TextDocument, importable: LuaImportable ) {
        const text = document.getText();

        const importStartMatch = this.importRegionStartPattern.exec( text );
        if( importStartMatch === null ) {
            throw Error( "Cannot find import region.  Is it missing?" );
        }
        const importStartIndex = importStartMatch.index + importStartMatch[0].length;

        const edit = new vscode.WorkspaceEdit();

        edit.insert(
            document.uri,
            document.positionAt( importStartIndex ),
            LuaImportManager.getLuaImportString( importable )
        );

        vscode.workspace.applyEdit( edit );
    }

    private static getLuaImportString( importable: LuaImportable ): string {
        const variableName = importable.className.substring( 0, 1 ).toLowerCase() + importable.className.substring( 1, );

        let importStatement = "\n\n";
        importStatement += `    --- @type ${importable.className}\n`;
        importStatement += `    local ${variableName} = CNC.Import( "${importable.importPath}" )`;

        return importStatement;
    }

}