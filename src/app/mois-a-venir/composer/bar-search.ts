/** Search presentation only; never an identity or a canonical match. */
export const barSearchText=(text:string)=>text.normalize("NFD").replace(/\p{Diacritic}/gu,"").toLocaleLowerCase("fr").trim();
