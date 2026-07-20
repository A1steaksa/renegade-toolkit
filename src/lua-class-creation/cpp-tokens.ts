export class Token {
    public static Pattern: RegExp = new RegExp( "" );

    public constructor(
        public Type: TokenType,
    ){}

    public static matches( input: string ): boolean {
        return this.Pattern.test( input );
    }
}

export class IdentifierToken extends Token {
    Pattern = /^[A-Za-z_][0-9A-Za-z_]*$/;

    public constructor(
        public Identifier: string
    ){
        super( TokenType.Identifier );
    }
}

export class AssignmentToken extends Token {
    Pattern = /^=$/;
    Token = TokenType.Assignment;
}

/*
 * Keywords
 */

export class ConstToken extends Token {
    public static Pattern = /^const$/;
    Token = TokenType.Const;
}

export class StaticToken extends Token {
    public static Pattern = /^static$/;
    Token = TokenType.Static;
}

export class VirtualToken extends Token {
    public static Pattern = /^virtual$/;
    Token = TokenType.Virtual;
}

export class NewToken extends Token {
    public static Pattern = /^new$/;
    Token = TokenType.New;
}

export class ThisToken extends Token {
    public static Pattern = /^this$/;
    Token = TokenType.This;
}


export enum TokenType {
    Identifier,     // Created

    // Keywords
    Const,          // Created
    Static,         // Created
    Virtual,        // Created
    New,            // Created
    This,           // Created
    Inline,
    Friend,
    Mutable,
    Default,
    Template,
    Return,
    Namespace,
    Delete,
    Export,

    Class,
    Struct,
    Enum,

    // Access 
    Public,
    Private,
    Protected,

    // Types
    Short,
    Int,
    Long,
    Float,
    Double,
    String,
    Void,
    Bool,
    True,
    False,
    Char,
    
    // Type Modifiers
    Signed,
    Unsigned,
    
    
    // Flow control
    If,
    Else,
    Do,
    While,
    For,
    Try,
    Catch,
    Switch,
    Case,
    Continue,
    Break,

    // Operators
    Assignment,
    Add,
    Multiply,
    Relation,
    TypeOf,
    Goto,
}

export const Tokens: {[index:string] : any } = {
    IdentifierToken,
    AssignmentToken,

    // Keywords
    ConstToken,
    StaticToken,

};