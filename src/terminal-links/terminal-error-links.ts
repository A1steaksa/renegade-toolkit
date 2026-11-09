import * as vscode from 'vscode';
import { Module } from '../module';
import { ErrorLinks } from './error-links';

export class TerminalLinks implements Module {
    public static initialize( context: vscode.ExtensionContext ){
        const linkProviderDisposable = vscode.window.registerTerminalLinkProvider( new ErrorLinks() );
        context.subscriptions.push( linkProviderDisposable );
    }
}

