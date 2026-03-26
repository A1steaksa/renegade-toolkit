
import * as vscode from 'vscode';
import { LuaImportableCache } from './importable-class-cache';
import { LuaEnum } from './importables/lua-enum';
import { LuaClass } from './importables/lua-class';
    
export class LuaImportAction implements vscode.CodeActionProvider {

    private static luaGlobalVariableNamePattern = /\`\w+\`/gm;

    public static createClassImportCommand( document: vscode.TextDocument, importable: LuaClass ): vscode.Command {
        return {
            title: "Import " + importable.getStaticName() + " from " + importable.getImportPath() + "?" ,
            command: "renegade-toolkit.addClassImport",
            arguments: [
                document,
                importable
            ]
        };
    }

    public static createEnumImportCommand( document: vscode.TextDocument, importable: LuaEnum ): vscode.Command {
        return {
            title: "Import " + importable.getStaticName() + " from " + importable.getContainingClass().getStaticName() + "?" ,
            command: "renegade-toolkit.addEnumImport",
            arguments: [
                document,
                importable
            ]
        };
    }

    provideCodeActions( document: vscode.TextDocument, range: vscode.Range | vscode.Selection, context: vscode.CodeActionContext, token: vscode.CancellationToken ): vscode.ProviderResult<( vscode.CodeAction | vscode.Command )[]> {
        let missingVariableName = this.getMissingVariableName( context );
        if( missingVariableName === undefined ){
            return;
        }

        const actions: vscode.Command[] = [];

        // Class imports
        const luaClasses = LuaImportableCache.findLuaClassesByName( missingVariableName );
        for (let classIndex = 0; classIndex < luaClasses.length; classIndex++) {
            const luaClass = luaClasses[classIndex];
            
            actions.push(
                LuaImportAction.createClassImportCommand( document, luaClass )
            );
        }

        // Enum imports
        const luaEnums = LuaImportableCache.findLuaEnumsByName( missingVariableName );
        for (let enumIndex = 0; enumIndex < luaEnums.length; enumIndex++) {
            const luaEnum = luaEnums[enumIndex];

            actions.push(
                LuaImportAction.createEnumImportCommand( document, luaEnum )
            );
        }

        if( actions.length !== 0 ){
            return actions;
        }
    }

    private getMissingVariableName( context: vscode.CodeActionContext ): string | undefined {
        let result: string | undefined;
        context.diagnostics.forEach( ( diagnostic ) => {
            if( diagnostic.message.includes( "Undefined global" ) ) {

                // Find the name of the variable that doesn't exist
                const variableNameMatches = diagnostic.message.match( LuaImportAction.luaGlobalVariableNamePattern );
                if( variableNameMatches === null ) {
                    return;
                }
                const variableName = variableNameMatches[0].replaceAll( "`", "" ).trim();

                result = variableName;
            }
        } );

        return result;
    }
}
