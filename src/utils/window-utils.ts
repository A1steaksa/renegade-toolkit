import * as vscode from 'vscode';

export class WindowUtils {

    public static showFile( file: vscode.Uri ){
        const editors = vscode.window.visibleTextEditors;
        const filePath = file.path;

        // Abort if the file is already visible somewhere in the window
        for( let editorIndex = 0; editorIndex < editors.length; editorIndex++ ){
            const editor = editors[editorIndex];
            if( editor.document.uri.path === filePath ){
                return;
            }
        }

        vscode.window.showTextDocument( file );
    }

}