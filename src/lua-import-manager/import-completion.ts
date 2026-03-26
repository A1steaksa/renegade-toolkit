import * as vscode from 'vscode';
import { LuaImportManager } from './import-manager';
import { LuaImportableCache } from './importable-class-cache';
import { LuaImportAction } from './import-action';

export class LuaImportCompletion implements vscode.CompletionItemProvider {

    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext
    ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList<vscode.CompletionItem>> {
        const wordRange = document.getWordRangeAtPosition( position );
        const triggerWord = document.getText( wordRange );

        const importCommands: vscode.CompletionItem[] = [];

        // Class imports
        const luaClasses = LuaImportableCache.findLuaClassesByName( triggerWord );
        for (let classIndex = 0; classIndex < luaClasses.length; classIndex++) {
            const luaClass = luaClasses[classIndex];

            // Don't try to import twice
            if( LuaImportManager.doesDocumentImportClass( document, luaClass ) ){
                return;
            }

            const classImportCompletionItem = new vscode.CompletionItem(
                luaClass.getStaticName(),
                vscode.CompletionItemKind.Class
            );

            classImportCompletionItem.filterText = triggerWord;
            classImportCompletionItem.command = LuaImportAction.createClassImportCommand( document, luaClass );
            classImportCompletionItem.insertText = luaClass.getVariableName();
            classImportCompletionItem.detail = `Import ${luaClass.getStaticName()} from ${luaClass.getImportPath()}`;

            importCommands.push( classImportCompletionItem );
        }

        // Enum imports
        const luaEnums = LuaImportableCache.findLuaEnumsByName( triggerWord );
        for (let enumIndex = 0; enumIndex < luaEnums.length; enumIndex++) {
            const luaEnum = luaEnums[enumIndex];

            // Don't try to import twice
            if( LuaImportManager.doesDocumentImportClass( document, luaEnum.getContainingClass() ) ){
                if( LuaImportManager.doesDocumentImportEnum( document, luaEnum ) ){
                    return;
                }
            }

            const enumImportCompletionItem = new vscode.CompletionItem(
                luaEnum.getStaticName(),
                vscode.CompletionItemKind.Enum
            );

            enumImportCompletionItem.filterText = triggerWord;
            enumImportCompletionItem.command = LuaImportAction.createEnumImportCommand( document, luaEnum );
            enumImportCompletionItem.insertText = luaEnum.getVariableName();
            enumImportCompletionItem.detail = `Import ${luaEnum.getStaticName()} from ${luaEnum.getContainingClass().getStaticName()}`;

            importCommands.push( enumImportCompletionItem );
        }

        return new vscode.CompletionList( importCommands );
    }
}
