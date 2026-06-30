import * as vscode from 'vscode';
import { config } from '../extension';
import { ConfigUtils } from '../utils/config-utils';

class ErrorLink extends vscode.TerminalLink {
    public constructor( startIndex: number, endIndex: number, public path: string, public lineNumber: number ){
        super( startIndex, endIndex - startIndex );
    }
}

export class ErrorLinks implements vscode.TerminalLinkProvider {

    private static linkPattern = /(?:addons\/[\w+\/-]+\.lua):(?:[0-9]+)/i;


    public provideTerminalLinks( context: vscode.TerminalLinkContext, token: vscode.CancellationToken ): vscode.ProviderResult<vscode.TerminalLink[]> {
        const line = context.line;
        
        const match = ErrorLinks.linkPattern.exec( line );
        const isStacktraceLine = ( match !== undefined && match !== null );
        if( !isStacktraceLine ){ return; }

        const linkStartIndex = line.indexOf( "addons/" );
        const colonIndex = line.indexOf( ":", linkStartIndex );

        // Either a second colon or the end of the line, whichever is applicable to this line 
        let lineNumberEndIndex = line.indexOf( ":", colonIndex + 1 );
        if( lineNumberEndIndex === -1 ){
            lineNumberEndIndex = line.length;
        }

        const path = line.substring( linkStartIndex, colonIndex );
        const lineNumberString = line.substring( colonIndex + 1, lineNumberEndIndex );
        const lineNumber = Number( lineNumberString );

        const link = new ErrorLink( linkStartIndex, lineNumberEndIndex, path, lineNumber );

        return [link];
    }

    public async handleTerminalLink( link: ErrorLink ){
        console.log( "Jumping to " + link.path + ":" + link.lineNumber );

        const blob = "**/" + link.path.substring( ConfigUtils.GetLuaCodeRoot().length - 1 );

        const foundFiles = await vscode.workspace.findFiles( blob, null, 1 );
        if( foundFiles.length === 0 ){
            console.log( "Could not find file to jump to: " + blob );
            return;
        }

        const file = foundFiles[0];

        vscode.window.showTextDocument( file, {selection: new vscode.Range( link.lineNumber - 1, 0, link.lineNumber, 0 ),viewColumn: vscode.ViewColumn.One } );
    }
}
