import * as vscode from 'vscode';

export abstract class LuaImportable {
    
    protected static getIndentString( indentCount: number ) : string {
        const editor = vscode.window.activeTextEditor;
        if( editor === undefined ){
            throw new Error( "No active text editor could be found during indent string creation" );
        }

        const indentSize = editor.options.indentSize;
        return " ".repeat( indentSize as number );
    }

    public abstract getName(): string;

    public abstract getContainingFile(): vscode.Uri;

    public abstract getContainingDocument(): Promise<vscode.TextDocument>;

    /**
     * @returns The string that should be used to import this Lua importable.  May be indented and/or contain multiple lines.
     */
    abstract getImportString(): string;
    
    abstract equals( other: any ): boolean;
}