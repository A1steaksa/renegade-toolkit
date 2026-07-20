import { CppDataType } from "../cpp-classes/cpp-data-type";
import { CppToLuaTypeConverter } from "../data-type-converter";

export class LuaDataType {
    public constructor(
        public Name: string,
        public ArrayDepth: number = 0,
        public Generics: LuaDataType[] | undefined,
    ){}

    public static fromCpp( cppDataType: CppDataType ): LuaDataType {
        let name = CppToLuaTypeConverter.getLuaDataType( cppDataType.Name );

        let generics: LuaDataType[] | undefined;
        if( cppDataType.Generics !== undefined ){
            generics = [];
            for( let genericIndex = 0; genericIndex < cppDataType.Generics.length; genericIndex++ ){
                generics.push( this.fromCpp( cppDataType.Generics[genericIndex] ) );
            }
        }

        return new LuaDataType( name, generics );
    }
}