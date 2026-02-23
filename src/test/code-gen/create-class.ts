import * as vscode from 'vscode';
import { CommandBase } from "./command-base";


export class CreateClassCommand extends CommandBase {

    /** The filename of the Handlebars template file */
    protected templateFileName = "class-template.handlebars";

    /** The postfix ending for Lua class names when referring to the class's static components */
    private static staticClassPostfix = "Class";

    /** The postfix ending for Lua class names when referring to the class's instanced components */
    private static instanceClassPostfix = "Instance";

    /** The prefix start for RobustClass instanced class names */
    private static robustClassPrefix = "Renegade_";

    protected async runWizard(): Promise<Object | undefined> {
        
        let result: any = {};

        const cppClassName = await CommandBase.getUserString(
            "Original C++ Class Name",
            undefined,
            undefined,
            "E.g. DefinitionMgrClass, BaseGameObj, HUDClass"
        );
        if( cppClassName === undefined ) { return; }
        result.CppClassName = cppClassName;


        const cppFilePath = await CommandBase.getUserString(
            "Original C++ File Path",
            undefined,
            undefined,
            "E.g. Code/Combat/ccamera.cpp, Code/wwsaveload/definitionmgr.cpp/h"
        );
        if( cppFilePath === undefined ){ return; }
        result.CppFilePath = cppFilePath;


        const luaBaseClassName = await CommandBase.getUserString(
            "Lua Language Server Class Name",
            "This is the basis for the various class name forms in Lua",
            undefined,
            "E.g. CommandoCameraProfile, Offense, ChunkLoad"
        );
        if( luaBaseClassName === undefined ){ return; }
        result.LuaBaseClassName     = luaBaseClassName;


        const isStaticOnly = await CommandBase.getUserBoolean(
            "Static-only Class",
            "Is this a static-only class?"
        );
        if( isStaticOnly === undefined ){ return; }
        result.IsStaticOnly = isStaticOnly;


        const hasParent = await CommandBase.getUserBoolean(
            "Has Parent",
            "Does this Lua class inherit from another Lua class?"
        );
        if( hasParent === undefined ){ return; }
        result.HasParent = hasParent;


        if( hasParent ){
            const parentLuaClassName = await CommandBase.getUserString(
                "Parent Lua Language Server Class Name",
                undefined,
                undefined,
                "E.g. CommandoCameraProfileClass, OffenseClass, ChunkLoadClass"
            );
            if( parentLuaClassName === undefined ){ return; }
            result.ParentLuaClassName = parentLuaClassName;


            const rawParentLuaClassPath = await CommandBase.getUserString(
                "Parent Class File Path",
                "Relative to the lua/ folder",
                undefined,
                "E.g. code/wwsaveload/save-load.lua, code/wwsaveload/persist.lua"
            );
            if( rawParentLuaClassPath === undefined ){ return; }
            result.RawParentLuaClassPath = rawParentLuaClassPath;
        }

        
        const containsEnums = await CommandBase.getUserBoolean(
            "Enums",
            "Does this class contain enums?"
        );
        if( containsEnums === undefined ){ return; }
        result.ContainsEnums = containsEnums;


        if( !isStaticOnly ){
            const needsSaveLoad = await CommandBase.getUserBoolean(
                "Save/Load Functions",
                "Does this class need Save and Load functions?"
            );
            if( needsSaveLoad === undefined ){ return; }
            result.NeedsSaveLoad = needsSaveLoad;
    
            
            if( needsSaveLoad ){
                const needsChunkIds = await CommandBase.getUserBoolean(
                    "Chunk IDs",
                    "Does this class need Chunk IDs for its Save/Load functions?"
                );
                if( needsChunkIds === undefined ){ return; }
                result.NeedsChunkIds = needsChunkIds;
            }
        }

        return result;
    }

    protected async processWizardResult( result: any ) : Promise<Object | undefined> {

        const luaBaseClassName      = result.LuaBaseClassName;
        const parentLuaClassName    = result.ParentLuaClassName;
        const rawParentLuaClassPath = result.RawParentLuaClassPath;

        result.LuaInstanceClassName = CreateClassCommand.createInstanceClassName( luaBaseClassName );
        result.LuaStaticClassName   = CreateClassCommand.createStaticClassName( luaBaseClassName );
        result.LuaRobustClassName   = CreateClassCommand.createRobustClassName( luaBaseClassName );

        result.ParentLuaInstanceClassName = CreateClassCommand.createInstanceClassName( parentLuaClassName );
        result.ParentLuaStaticClassName   = CreateClassCommand.createStaticClassName( parentLuaClassName );
        result.ParentLuaRobustClassName   = CreateClassCommand.createRobustClassName( parentLuaClassName );

        result.ParentLuaClassPath = CreateClassCommand.createLuaFilePath( rawParentLuaClassPath );

        return result;
    }

    /**
     * @param className
     * @returns The given class name without instance, static, or Robustclass identifiers.
     */
    static createBaseClassName( className: string ): string {
        let result = className.trim();

        // If they give us a RobustClass clas name
        if( result.startsWith( this.robustClassPrefix ) ){
            result = result.substring( this.robustClassPrefix.length );
        }

        // If they give us a static class name
        if( result.endsWith( this.staticClassPostfix ) ) {
            result = result.substring( 0, result.length - this.staticClassPostfix.length );
        }

        // If they give us an instanced class name
        if( result.endsWith( this.instanceClassPostfix ) ) {
            result = result.substring( 0, result.length - this.instanceClassPostfix.length );
        }

        return result;
    }

    /**
     * @returns The Lua class name to use for the static components of the provided class
     */
    static createStaticClassName( baseClassName: string ): string {
        return this.createBaseClassName( baseClassName ) + this.staticClassPostfix;
    }

    /**
     * @returns The Lua class name to use for the instanced components of the provided class
     */
    static createInstanceClassName( baseClassName: string ): string {
        return this.createBaseClassName( baseClassName ) + this.instanceClassPostfix;
    }

    /**
     * @param baseClassName
     * @returns 
     */
    static createRobustClassName( baseClassName: string ): string {
        return this.robustClassPrefix + this.createBaseClassName( baseClassName );
    }

    /**
     * Removes the extension from a given file path
     * @param filePath
     * @returns
     */
    static createBaseFilePath( filePath: string ): string {
        let result = filePath.trim();

        const maxExtensionLength = 8;
        const minExtensionLength = 2;

        // Find and remove a file extension if one exists
        const extensionStartIndex = result.lastIndexOf( "." );
        const extensionStartDistanceFromEnd = result.length - extensionStartIndex;
        const isValidExtension = (
            extensionStartDistanceFromEnd <= maxExtensionLength
            && extensionStartDistanceFromEnd > minExtensionLength
        );
        if( isValidExtension ){
            result = result
                .substring( 0, extensionStartIndex )
                .trim();
        }

        // Remove a trailing period `.` if one exists
        if( result.endsWith( "." ) ){
            result = result.substring( 0, result.length - 1 ).trim();
        }

        return result;
    }

    /**
     * @param baseCppPath
     * @returns
     */
    static createOriginalCppFilePath( baseCppPath: string ): string {
        return this.createBaseFilePath( baseCppPath ) + ".cpp/h";
    }

    /**
     * @param baseLuaFilePath
     * @returns
     */
    static createLuaFilePath( baseLuaFilePath: string ): string {
        return this.createBaseFilePath( baseLuaFilePath ) + ".lua";
    }

}