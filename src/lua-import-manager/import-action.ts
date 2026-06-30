
import * as vscode from 'vscode';
import { LuaImportableCache } from './importable-class-cache';
import { LuaEnum } from './importables/lua-enum';
import { LuaClass } from './importables/lua-class';
    
export class LuaImportAction implements vscode.CodeActionProvider {

    private static luaGlobalVariableNamePattern = /\`\w+\`/gm;

    public static createClassImportAction( document: vscode.TextDocument, importable: LuaClass ): vscode.CodeAction {
        const importCommand = {
            title: "Import " + importable.getStaticName() + " from " + importable.getImportPath() + "?" ,
            command: "renegade-toolkit.addClassImport",
            arguments: [
                document,
                importable
            ]
        };

        // Apparently VSCode has a soft requirement that each CodeAction has a diagnostic
        const diagnostic = new vscode.Diagnostic(
            new vscode.Range(
                new vscode.Position( 0, 0 ),
                new vscode.Position( 0, 0 )
            ),
            importCommand.title,
            vscode.DiagnosticSeverity.Hint
        );

        const importAction = new vscode.CodeAction( importCommand.title, vscode.CodeActionKind.QuickFix );
        importAction.isPreferred = true;
        importAction.diagnostics = [diagnostic];
        importAction.command = importCommand;

        return importAction;
    }

    public static createEnumImportAction( document: vscode.TextDocument, importable: LuaEnum ): vscode.CodeAction {
        const importCommand = {
            title: "Import " + importable.getStaticName() + " from " + importable.getContainingClass().getStaticName() + "?" ,
            command: "renegade-toolkit.addEnumImport",
            arguments: [
                document,
                importable
            ]
        };

        // Apparently VSCode has a soft requirement that each CodeAction has a diagnostic
        const diagnostic = new vscode.Diagnostic(
            new vscode.Range(
                new vscode.Position( 0, 0 ),
                new vscode.Position( 0, 0 )
            ),
            importCommand.title,
            vscode.DiagnosticSeverity.Hint
        );

        const importAction = new vscode.CodeAction( importCommand.title, vscode.CodeActionKind.QuickFix );
        importAction.isPreferred = true;
        importAction.diagnostics = [diagnostic];
        importAction.command = importCommand;

        return importAction;
    }

    provideCodeActions( document: vscode.TextDocument, range: vscode.Range | vscode.Selection, context: vscode.CodeActionContext, token: vscode.CancellationToken ): vscode.ProviderResult<( vscode.CodeAction | vscode.Command )[]> {
        let missingVariableName = this.getMissingVariableName( context );
        if( missingVariableName === undefined ){
            return;
        }

        const actions: vscode.CodeAction[] = [];

        // Class imports
        const luaClasses = LuaImportableCache.findLuaClassesByName( missingVariableName );

        for( let classIndex = 0; classIndex < luaClasses.length; classIndex++ ){
            const luaClass = luaClasses[classIndex];

            actions.push( LuaImportAction.createClassImportAction( document, luaClass ) );
        }

        // Enum imports
        const luaEnums = LuaImportableCache.findLuaEnumsByName( missingVariableName );
        for (let enumIndex = 0; enumIndex < luaEnums.length; enumIndex++) {
            const luaEnum = luaEnums[enumIndex];

            actions.push( LuaImportAction.createEnumImportAction( document, luaEnum ) );
        }

        console.log( "Actions: ", actions );

        return actions;
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
