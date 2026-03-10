import { TextUtils } from "../../text-utils";
import { LuaClass } from "./lua-class";
import { LuaImportable } from "./lua-importable";
import * as vscode from 'vscode';

export class LuaEnum extends LuaImportable {
    
    private name: string;
    private containingClass: LuaClass;

    constructor( name: string, containingClass: LuaClass ){
        super();

        this.name = TextUtils.capitalize( name );
        this.containingClass = containingClass;
    }

    public getName(): string {
        return this.name;
    }

    public getContainingFile(): vscode.Uri {
        return this.containingClass.getContainingFile();
    }
    
    public getContainingDocument(): Promise<vscode.TextDocument> {
        return this.containingClass.getContainingDocument();
    }

    public getContainingClass(): LuaClass {
        return this.containingClass;
    }
    
    public getVariableName(): string {
        let enumVariableName = TextUtils.uncapitalize( this.name );
        if( !enumVariableName.endsWith( "Enum" ) ){
            enumVariableName += "Enum";
        }
        return enumVariableName;
    }

    getImportString(): string {
        const indentString = LuaImportable.getIndentString( 1 );
        const classVariableName = TextUtils.uncapitalize( this.containingClass.getName() );
        const enumStaticVariableName = TextUtils.camelCaseToUnderscoreCapitals( this.name );

        return indentString + "local " + this.getVariableName() + " = " + classVariableName + "." + enumStaticVariableName;
    }
    
    equals( other: any ): boolean {
        if( other instanceof LuaEnum ){
            const otherClass = other as LuaEnum;
            return (
                otherClass.name === this.name
                && ( 
                    otherClass.containingClass.getContainingFile().path
                    ===
                    this.containingClass.getContainingFile().path
                )
            );
        }

        return false;
    }
}