import * as vscode from 'vscode';

export abstract class LuaImportable {

    public abstract getStaticName(): string;

    public abstract getContainingFile(): vscode.Uri;

    public abstract getContainingDocument(): Promise<vscode.TextDocument>;

    /**
     * @returns The string that should be used to import this Lua importable.  May be indented and/or contain multiple lines.
     */
    abstract getImportString(): string;
    
    abstract equals( other: any ): boolean;
}