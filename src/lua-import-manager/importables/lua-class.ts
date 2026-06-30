import { LuaImportable } from "./lua-importable";
import { TextUtils } from "../../utils/text-utils";
import * as vscode from 'vscode';
import { config } from '../../extension';
import { ConfigUtils } from "../../utils/config-utils";

export class LuaClass extends LuaImportable {
    
    private static luaAddonPath: string;

    private baseName: string;
    private staticName: string;
    private instanceName: string;
    private containingFile: vscode.Uri;
    private document: vscode.TextDocument | undefined;
    
    private static getLuaAddonPath(): string {
        if( this.luaAddonPath === undefined ){
            this.luaAddonPath = ConfigUtils.GetLuaCodeRoot();
        }

        return this.luaAddonPath;
    }

    constructor( staticName: string, containingFile: vscode.Uri ) {
        super();

        this.baseName = TextUtils.removeEndings(
            TextUtils.capitalize( staticName ),
            ["Class", "Instance"]
        );

        // Some files contain static-only data and don't follow normal class naming
        if(
            staticName.endsWith( "Ids" ) || staticName.endsWith( "Utils" ) || staticName.endsWith( "Types" ) || staticName.endsWith( "Lib" )
        ){
            this.staticName = this.baseName;
            this.instanceName = this.baseName;
        }else{
            this.staticName = this.baseName + "Class";
            this.instanceName = this.baseName + "Instance";
        }

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

    public getRobustClassName(): string {
        return `Renegade_` + this.baseName;
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