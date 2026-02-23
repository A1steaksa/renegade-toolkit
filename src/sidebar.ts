
import * as vscode from 'vscode';

export class RenegadeSidebarProvider implements vscode.WebviewViewProvider {

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ){
        
        webviewView.webview.options = {
            enableScripts: true
        };

        webviewView.webview.html = this.getHtml();

        webviewView.webview.onDidReceiveMessage( data => {

        } );
    }

    private getHtml(): string{

        return `
        <!DOCTYPE html>
        <html lang="en">

        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body>
            
            <div>
                
            </div>
        
            <button>Button Text Here</button>
        </body>
        </html>
        `;
    }

}