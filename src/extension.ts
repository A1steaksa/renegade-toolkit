import * as vscode from 'vscode';
import { LanguageSwitcher } from './language-switcher/language-switcher';
import { LuaImportManager } from './lua-import-manager/import-manager';
import { LuaScanner } from './file-scanner/lua-scanner';
import { LuaClassCreation } from './lua-class-creation/lua-class-creation';
import { TerminalLinks } from './terminal-links/terminal-error-links';
import { FunctionLinks } from './function-links/function-links';
import { CppScanner } from './file-scanner/cpp-scanner';

export const config = vscode.workspace.getConfiguration( "renegade-toolkit" );

export function activate( context: vscode.ExtensionContext ) {
    // Set up scanners
    // HeaderScanner.initialize( context );
    CppScanner.initialize( context );
    LuaScanner.initialize( context );

    // Set up things that use scanners
    LuaImportManager.initialize( context );
    LanguageSwitcher.initialize( context );

    LuaClassCreation.initialize( context );

    TerminalLinks.initialize( context );
    FunctionLinks.initialize( context );

    // Start scanning
    LuaScanner.start();
    CppScanner.start();
    // HeaderScanner.start();
}