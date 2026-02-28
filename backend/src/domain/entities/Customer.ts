export interface Customer {
  _id?: string;
  customerId: string;
  name: string;
  phoneNumber: string;
  email?: string;
  projects: string[];
  inquiryId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
