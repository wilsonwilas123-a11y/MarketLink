/** Mirrors `server/src/api/schemas.ts`. Field names stay snake_case so responses need no mapping. */

export type Role = 'customer' | 'farmer' | 'admin';

/** The role a signed-in account may ask bootstrap to grant. `admin` is not one of them. */
export type RequestableRole = Exclude<Role, 'admin'>;

export interface Profile {
  id: string;
  role: Role;
  full_name: string;
  phone: string;
  address: string | null;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type FarmerStatus = 'pending' | 'approved' | 'suspended';

/** The stall a farmer owns, if they have one. `null` for customers. */
export interface FarmerLink {
  id: string;
  stall_name: string;
  status: FarmerStatus;
}

export interface Me {
  profile: Profile;
  farmer: FarmerLink | null;
}

export interface BootstrapInput {
  full_name: string;
  phone: string;
  address?: string;
  role: RequestableRole;
}
