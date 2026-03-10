import { LuaImportable } from "./lua-importable";
import { TextUtils } from "../../text-utils";
import * as vscode from 'vscode';
import { config } from '../../extension';

export class LuaClass extends LuaImportable {
    
    private static luaAddonPath: string;

    private name: string;
    private containingFile: vscode.Uri;
    private document: vscode.TextDocument | undefined;
    
    private static getLuaAddonPath(): string {
        if( this.luaAddonPath === undefined ){
            this.luaAddonPath = config.get<string>( "LuaAddonPath" )!.trim();
        }

        return this.luaAddonPath;
    }

    constructor( name: string, containingFile: vscode.Uri ) {
        super();

        this.name = TextUtils.capitalize( name );;
        this.containingFile = containingFile;
    }

    public getName(): string {
        return this.name;
    }

    public getContainingFile(): vscode.Uri {
        return this.containingFile;
    }

    public async getContainingDocument(): Promise<vscode.TextDocument> {
        if( this.document === undefined ){
            this.document = await vscode.workspace.openTextDocument( this.containingFile );
        }

        return this.document;
    }

    /**
     * @returns The shortened version of the class's file path that should be used to import it in Lua
     */
    getImportPath(): string {
        const addonPath = LuaClass.getLuaAddonPath();
        const importPathStartIndex = this.containingFile.path.indexOf( addonPath ) + addonPath.length;
        let importPath = this.containingFile.path.substring( importPathStartIndex ).trim();
        
        if( importPath.startsWith( "/" ) ) {
            importPath = importPath.substring( 1 );
        }

        return importPath;
    }

    public getVariableName(): string {
        return TextUtils.uncapitalize( this.name );
    }

    getImportString(): string {
        const indentString = LuaImportable.getIndentString( 1 );

        let importStatement = "";
        importStatement += `${indentString}--- @type ${this.name}\n`;
        importStatement += `${indentString}local ${this.getVariableName()} = CNC.Import( "${ this.getImportPath() }" )`;

        return importStatement;
    }
    

    equals( other: any ): boolean {
        if( other instanceof LuaClass ){
            const otherClass = other as LuaClass;
            return (
                otherClass.name === this.name
                && otherClass.containingFile.path === this.containingFile.path
            );
        }

        return false;
    }
    
}