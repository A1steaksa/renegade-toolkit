import Module from 'module';
import * as vscode from 'vscode';
import { ClassFileCache as ClassFileCache, FileConnection } from './class-file-cache';

enum FileType {
    Header,
    Cpp,
    Lua
}

export class LanguageSwitcher extends Module {

    static headerFileToOpen: vscode.Uri | undefined;
    static cppFileToOpen: vscode.Uri | undefined;
    static luaFileToOpen: vscode.Uri | undefined;

    static buttonVisibilityVariables = {
        [ FileType.Header ]: "renegade-toolkit.showSwitchToHeader",
        [ FileType.Cpp    ]: "renegade-toolkit.showSwitchToCpp",
        [ FileType.Lua    ]: "renegade-toolkit.showSwitchToLua"
    };

    static buttonEnablementVariables = {
        [ FileType.Header ]: "renegade-toolkit.enableSwitchToHeader",
        [ FileType.Cpp    ]: "renegade-toolkit.enableSwitchToCpp",
        [ FileType.Lua    ]: "renegade-toolkit.enableSwitchToLua"
    };

    static initialize( context: vscode.ExtensionContext ){

        // Monitor Lua and C++ files for connections between them
        ClassFileCache.initialize( context );

        // Monitor active editor document changes to enable/disable the switching buttons
        LanguageSwitcher.setupEditorWatchers( context );
        
        // Setup the commands used by the language change buttons
        LanguageSwitcher.setupCommands( context );
        
        const editor = vscode.window.activeTextEditor;
        if( editor !== undefined ){
            this.updateButtonVisibility( editor );
        }
    }
    
    static setupCommands( context: vscode.ExtensionContext ){
        // Setup Switch to C++ Command
        const switchToCppDisposable = vscode.commands.registerCommand(
            "renegade-toolkit.switchToCpp", LanguageSwitcher.switchToCpp
        );

        // Setup Swtich to Header Command
        const switchToHeaderDisposable = vscode.commands.registerCommand(
            "renegade-toolkit.switchToHeader", LanguageSwitcher.switchToHeader
        );

        // Setup Switch to Lua Command
        const switchToLuaDisposable = vscode.commands.registerCommand(
            "renegade-toolkit.switchToLua", LanguageSwitcher.switchToLua
        );
        
        context.subscriptions.push( switchToCppDisposable, switchToHeaderDisposable, switchToLuaDisposable );
    }

    static setupEditorWatchers( context: vscode.ExtensionContext ){

        const textEditorChangeDisposable = vscode.window.onDidChangeActiveTextEditor( ( editor ) => {
            if( editor !== undefined ){
                LanguageSwitcher.updateButtonVisibility( editor );
            }
        } );

        const textDocumentChangeDisposable = vscode.workspace.onDidChangeTextDocument( ( event ) => {
            if( event.document === vscode.window.activeTextEditor?.document ){
                const editor = vscode.window.activeTextEditor;

                LanguageSwitcher.updateButtonVisibility( editor );
            }
        } );

        context.subscriptions.push( textEditorChangeDisposable, textDocumentChangeDisposable );
    }


    static setButtonVisibility( button: FileType, isVisible: boolean ){
        const buttonVisibilityVariable = this.buttonVisibilityVariables[button];
        vscode.commands.executeCommand( "setContext", buttonVisibilityVariable, isVisible );
    }


    static setButtonEnabled( button: FileType, isEnabled: boolean ){
        const buttonEnablementVariable = this.buttonEnablementVariables[button];
        vscode.commands.executeCommand( "setContext", buttonEnablementVariable, isEnabled );
    }

    static updateButtonVisibility( editor: vscode.TextEditor ){
        const currentDocument = editor.document;
        if( currentDocument === undefined ){
            this.setButtonVisibility( FileType.Header, false );
            this.setButtonVisibility( FileType.Cpp, false );
            this.setButtonVisibility( FileType.Lua, false );
            return;
        }

        let fileConnection = ClassFileCache.getFileConnection( currentDocument.uri );
        if( fileConnection === undefined ){
            this.setButtonVisibility( FileType.Header, false );
            this.setButtonVisibility( FileType.Cpp, false );
            this.setButtonVisibility( FileType.Lua, false );
            return;
        }

        const currentDocumentPath = currentDocument.uri.path;

        let currentDocumentType: FileType;
        if( currentDocumentPath.endsWith( ".h" ) ){
            currentDocumentType = FileType.Header;
        }else if( currentDocumentPath.endsWith( ".cpp" ) ){
            currentDocumentType = FileType.Cpp;
        }else if( currentDocumentPath.endsWith( ".lua" ) ){
            currentDocumentType = FileType.Lua;
        }else{
            return;
        }

        // Headers are only unavailable if they're active
        LanguageSwitcher.headerFileToOpen = fileConnection.headerFile;
        this.setButtonEnabled( FileType.Header, currentDocumentType !== FileType.Header );
        this.setButtonVisibility( FileType.Header, true );

        // Cpp files can be missing
        LanguageSwitcher.cppFileToOpen = fileConnection.cppFile;
        this.setButtonEnabled( FileType.Cpp, 
            fileConnection.cppFile !== undefined && currentDocumentType !== FileType.Cpp
        );
        this.setButtonVisibility( FileType.Cpp, fileConnection.cppFile !== undefined );

        // Lua files are only unavailable if they're active
        LanguageSwitcher.luaFileToOpen = fileConnection.luaFile;
        this.setButtonEnabled( FileType.Lua, currentDocumentType !== FileType.Lua );
        this.setButtonVisibility( FileType.Lua, true );
    }

    static switchToFile( file: vscode.Uri ){
        vscode.workspace.openTextDocument( file ).then(
            ( document ) => {
                vscode.window.showTextDocument( document );
            },
            () => {}
        );
    }

    static switchToCpp(){
        if( LanguageSwitcher.cppFileToOpen === undefined ){
            vscode.window.showErrorMessage( "Couldn't switch to C++ file because we don't know which one to open!" );
            return;
        }

        LanguageSwitcher.switchToFile( LanguageSwitcher.cppFileToOpen );
    }

    static switchToHeader(){
        if( LanguageSwitcher.headerFileToOpen === undefined ){
            vscode.window.showErrorMessage( "Couldn't switch to Header file because we don't know which one to open!" );
            return;
        }

        LanguageSwitcher.switchToFile( LanguageSwitcher.headerFileToOpen );
    }

    static switchToLua(){

        if( LanguageSwitcher.luaFileToOpen === undefined ){
            vscode.window.showErrorMessage( "Couldn't switch to Lua file because we don't know which one to open!" );
            return;
        }

        LanguageSwitcher.switchToFile( LanguageSwitcher.luaFileToOpen );
    }    
}