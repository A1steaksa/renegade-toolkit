import * as vscode from 'vscode';
import { CreateClassCommand } from './create-class';
import fs from 'fs';
import { CppFileParser } from './cpp-file-parser';
import { CommandBase } from './command-base';
import { AccessSpecifier } from './cpp-types';
import { RenegadeSidebarProvider } from './sidebar';

async function test() {
    const activeFile = vscode.window.activeTextEditor?.document;
    if( activeFile === undefined ) {
        vscode.window.showInformationMessage( "No text editor is active" );
        return;
    }

    // The command might be triggered on a .cpp or .h file.
    // We always need a .h file and should have a .cpp file if one exists,
    // so get those files immediately as the rest of the process relies on them.
    let headerFile: vscode.TextDocument | undefined;
    let cppFile: vscode.TextDocument | undefined;

    // Figure out if the active file is a header or cpp file
    const activeFilePath = activeFile.uri.path;
    const lowerActiveFilePath = activeFilePath.toLowerCase();

    if( lowerActiveFilePath.endsWith( ".h" ) ) {
        headerFile = activeFile;

        // Check for a matching .cpp file
        try {
            const cppFilePath = activeFilePath.substring( 0, activeFilePath.length - 2 ) + ".cpp";
            cppFile = await vscode.workspace.openTextDocument( cppFilePath );
        } catch( error ) {
            console.log( "Could not find .cpp file matching header: " + headerFile.uri.path );
        }

    } else if( lowerActiveFilePath.endsWith( ".cpp" ) ) {
        cppFile = activeFile;

        // Check for a matching .h file
        try {
            const headerFilePath = activeFilePath.substring( 0, activeFilePath.length - 4 ) + ".h";
            headerFile = await vscode.workspace.openTextDocument( headerFilePath );
        } catch( error ) {
            vscode.window.showErrorMessage( "Unable to find header file (.h) with the same name as the active file: " + activeFilePath );
            return;
        }
    } else {
        vscode.window.showErrorMessage( "The provided file is not a .cpp or .h file: ", activeFilePath );
        return;
    }

    if( headerFile === undefined ) {
        vscode.window.showErrorMessage( "No header file could be found" );
        return;
    }

    const cppFileParser = new CppFileParser( headerFile, cppFile );

    ( await cppFileParser.getClasses() ).forEach( cppClass => {
        console.log( cppClass.name );
    } );

    // const cppClasses = await cppFileParser.getClasses();

    // cppClasses.forEach( ( cppClass ) => {
    //     const cppParents = cppClass.getParents();

    //     console.log( cppClass.name );
    //     cppParents.forEach( ( cppParent ) => {
    //         console.log( "    " + AccessSpecifier[cppParent.accessSpecifier] + " " + cppParent.name );
    //     } );
    //     const cppFunctions = cppClass.getMethods();

    //     // console.log( "Header:", cppClass.headerDocument.fileName );
    //     // console.log( "   C++:", cppClass.cppDocument?.fileName );
    //     // console.log( cppClass.getHeaderText() );
    // } );

    // console.log( symbols[1] );

    // const classes = await parser.getClasses();

    // classes.forEach( element => {
    //     console.log( element );
    // } );

    // const tokensLegend = await vscode.commands.executeCommand( "vscode.provideDocumentSemanticTokensLegend", uri );
    // console.log( tokensLegend );

    // const tokens = await vscode.commands.executeCommand( "vscode.provideDocumentSemanticTokens", uri );
    // console.log( tokens );

    // const symbols = await vscode.commands.executeCommand( "vscode.executeDocumentSymbolProvider", uri );
    // console.log( symbols );
}


export function activate( context: vscode.ExtensionContext ) {

    /// Sidebar View
    const sidebarViewProvider = new RenegadeSidebarProvider();
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider( "renegade-sidbar-view", sidebarViewProvider )
    );

    /// Import Command
    const importDisposable = vscode.commands.registerCommand(
        "renegade-toolkit.import",
        async () => {

        }
    );
    context.subscriptions.push( importDisposable );

    /// Debugging Command
    const debugCommandDisposable = vscode.commands.registerCommand(
        "renegade-toolkit.debug",
        async () => {
            await test();
        }
    );
    context.subscriptions.push( debugCommandDisposable );

    /// Create Class
    const createClassDisposable = vscode.commands.registerCommand(
        "renegade-toolkit.createClass",
        async () => {
            const command = new CreateClassCommand();

            await command.runCommand();
        }
    );
    context.subscriptions.push( createClassDisposable );

    /// Create Class from JSON
    const createClassFromJsonDisposable = vscode.commands.registerCommand(
        "renegade-toolkit.createClassFromJson",
        async () => {

            let saveLocation: vscode.Uri | undefined;

            // Assume that triggering the command with a JSON file open 
            // means we want to use that JSON file as the input
            const editor = vscode.window.activeTextEditor;
            if( editor !== undefined ) {
                const documentLanguage = editor.document.languageId;
                if( documentLanguage === "json" ) {
                    saveLocation = editor.document.uri;
                }
            }

            // Otherwise, prompt the user to select a JSON file to open
            if( saveLocation === undefined ) {
                const classDefinitionFilePaths = await vscode.window.showOpenDialog( {
                    canSelectFiles: true,
                    canSelectMany: false,
                    filters: {
                        "JSON": ["json"],
                    },
                    openLabel: "Open Class Definition",
                    title: "Select Class Definition JSON"
                } );

                if( classDefinitionFilePaths === undefined ) {
                    vscode.window.showInformationMessage( "Class creation aborted" );
                    return;
                }

                saveLocation = classDefinitionFilePaths[0];
            }


            if( saveLocation === undefined ) {
                vscode.window.showInformationMessage( "Class creation aborted" );
                return;
            }

            const classDefinition = fs.readFileSync( saveLocation.fsPath ).toString();
            const classDefinitionObject = JSON.parse( classDefinition );

            const command = new CreateClassCommand();

            await command.runCommandSkipWizard( classDefinitionObject );
        }
    );
    context.subscriptions.push( createClassFromJsonDisposable );
}