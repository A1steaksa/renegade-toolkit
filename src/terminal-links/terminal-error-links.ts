import * as vscode from 'vscode';
import { Module } from '../module';
import { ErrorLinks } from './error-links';

export class TerminalLinks implements Module {
    
    public static initialize( context: vscode.ExtensionContext ){

        console.log( "Initializing terminal error links" );

        const linkProviderDisposable = vscode.window.registerTerminalLinkProvider( new ErrorLinks() );
        
        context.subscriptions.push( linkProviderDisposable );
    }

}

