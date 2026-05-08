// Types partagés entre le backend, le web et le mobile

export interface Article {
  _id?: string;
  nom: string;
  description?: string;
  quantite: number;
  prix?: number;
  categorie: string;
  codeBarres?: string;
  dateAjout: Date;
  dateModification: Date;
  utilisateur: string;
}

export interface Categorie {
  _id?: string;
  nom: string;
  description?: string;
  dateCreation: Date;
}

export interface Utilisateur {
  _id?: string;
  email: string;
  nom: string;
  motDePasse: string;
  dateCreation: Date;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface LoginRequest {
  email: string;
  motDePasse: string;
}

export interface LoginResponse {
  token: string;
  utilisateur: Utilisateur;
}
