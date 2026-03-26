import { LuaImportable } from "./lua-importable";
import { TextUtils } from "../../utils/text-utils";
import * as vscode from 'vscode';
import { config } from '../../extension';

export class LuaClass extends LuaImportable {
    
    private static luaAddonPath: string;

    private staticName: string;
    private instanceName: string;
    private containingFile: vscode.Uri;
    private document: vscode.TextDocument | undefined;
    
    private static getLuaAddonPath(): string {
        if( this.luaAddonPath === undefined ){
            this.luaAddonPath = config.get<string>( "LuaAddonPath" )!.trim();
        }

        return this.luaAddonPath;
    }

    constructor( staticName: string, containingFile: vscode.Uri ) {
        super();

        this.staticName = TextUtils.capitalize( staticName );
        this.instanceName = TextUtils.removeEndings( this.staticName, ["Class"] ) + "Instance";

        this.containingFile = containingFile;
    }

    public getStaticName(): string {
        return this.staticName;
    }

    public getInstanceName(): string {
        return this.instanceName;
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
        return TextUtils.uncapitalize( this.staticName );
    }

    getImportString(): string {
        let importStatement = "";
        importStatement += `--- @type ${this.staticName}\n`;
        importStatement += `local ${this.getVariableName()} = CNC.Import( "${ this.getImportPath() }" )`;

        return importStatement;
    }
    

    equals( other: any ): boolean {
        if( other instanceof LuaClass ){
            const otherClass = other as LuaClass;
            return (
                otherClass.staticName === this.staticName
                && otherClass.containingFile.path === this.containingFile.path
            );
        }

        return false;
    }
    
}