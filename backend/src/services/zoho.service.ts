import dotenv from 'dotenv';
dotenv.config();

export class ZohoService {
  private static accessToken: string | null = null;
  private static tokenExpiresAt: number = 0; // Unix timestamp in ms

  private static async getAccessToken(): Promise<string> {
    const now = Date.now();
    // If token exists and has more than 5 minutes left, return it
    if (this.accessToken && this.tokenExpiresAt > now + 300000) {
      return this.accessToken;
    }

    const clientId = process.env.ZOHO_CLIENT_ID;
    const clientSecret = process.env.ZOHO_CLIENT_SECRET;
    const refreshToken = process.env.ZOHO_REFRESH_TOKEN;
    const accountsUrl = process.env.ZOHO_ACCOUNTS_URL || 'https://accounts.zoho.com';

    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error('Zoho Books configuration credentials are missing in .env');
    }

    const tokenUrl = `${accountsUrl}/oauth/v2/token?refresh_token=${encodeURIComponent(refreshToken)}&client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}&grant_type=refresh_token`;
    const response = await fetch(tokenUrl, { method: 'POST' });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Failed to refresh Zoho token: ${response.statusText}. Details: ${errText}`);
    }

    const data: any = await response.json();
    if (data.error) {
      throw new Error(`Zoho OAuth Error: ${data.error}`);
    }

    this.accessToken = data.access_token;
    // expires_in is in seconds, convert to timestamp in ms
    this.tokenExpiresAt = now + (data.expires_in * 1000);

    return this.accessToken!;
  }

  public static async searchContacts(searchText: string): Promise<any[]> {
    try {
      const accessToken = await this.getAccessToken();
      const orgId = process.env.ZOHO_ORG_ID;
      const apiUrl = process.env.ZOHO_BOOKS_API_URL || 'https://www.zohoapis.com/books/v3';

      if (!orgId) {
        throw new Error('ZOHO_ORG_ID is missing in .env');
      }

      let allContacts: any[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore && page <= 25) { // Fetch up to 5,000 records
        const searchUrl = `${apiUrl}/contacts?organization_id=${orgId}&search_text=${encodeURIComponent(searchText)}&per_page=200&page=${page}`;
        const response = await fetch(searchUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Zoho-oauthtoken ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const errText = await response.text();
          console.error(`Zoho API searchContacts failed (page ${page}): ${errText}`);
          break;
        }

        const data: any = await response.json();
        if (data.contacts && data.contacts.length > 0) {
          allContacts.push(...data.contacts);
        }

        hasMore = data.page_context ? data.page_context.has_more_page : false;
        page++;
      }

      // Map Zoho Books contact details to our customer schema
      return allContacts.map((contact: any) => ({
        zohoContactId: contact.contact_id,
        companyName: contact.company_name || contact.contact_name,
        customerName: contact.contact_name,
        email: contact.email || '',
        mobileNumber: contact.mobile || contact.phone || '',
        gstTreatment: contact.gst_treatment || '',
        gstNumber: contact.gst_no || '',
        address: contact.billing_address 
          ? `${contact.billing_address.address || ''} ${contact.billing_address.city || ''} ${contact.billing_address.state || ''} ${contact.billing_address.zip || ''}`.trim()
          : ''
      }));
    } catch (error: any) {
      console.error('Error in searchContacts:', error.message);
      return [];
    }
  }

  public static async searchVendors(searchText: string): Promise<any[]> {
    try {
      const accessToken = await this.getAccessToken();
      const orgId = process.env.ZOHO_ORG_ID;
      const apiUrl = process.env.ZOHO_BOOKS_API_URL || 'https://www.zohoapis.com/books/v3';

      if (!orgId) {
        throw new Error('ZOHO_ORG_ID is missing in .env');
      }

      const encodedSearch = encodeURIComponent(searchText);
      let allContacts: any[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore && page <= 25) {
        const byCompanyUrl = `${apiUrl}/contacts?organization_id=${orgId}&contact_type=vendor&company_name_contains=${encodedSearch}&per_page=200&page=${page}`;
        const byContactUrl = `${apiUrl}/contacts?organization_id=${orgId}&contact_type=vendor&contact_name_contains=${encodedSearch}&per_page=200&page=${page}`;

        const [companyRes, contactRes] = await Promise.all([
          fetch(byCompanyUrl, { headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}`, 'Content-Type': 'application/json' } }),
          fetch(byContactUrl, { headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}`, 'Content-Type': 'application/json' } }),
        ]);

        if (!companyRes.ok && !contactRes.ok) {
          break;
        }

        const companyData: any = companyRes.ok ? await companyRes.json() : { contacts: [] };
        const contactData: any = contactRes.ok ? await contactRes.json() : { contacts: [] };

        const fetched = [...(companyData.contacts || []), ...(contactData.contacts || [])];
        allContacts.push(...fetched);

        const companyHasMore = companyData.page_context ? companyData.page_context.has_more_page : false;
        const contactHasMore = contactData.page_context ? contactData.page_context.has_more_page : false;

        hasMore = companyHasMore || contactHasMore;
        page++;
      }

      // Merge & deduplicate by contact_id
      const seen = new Set<string>();
      const combined: any[] = [];
      for (const c of allContacts) {
        if (!seen.has(c.contact_id)) {
          seen.add(c.contact_id);
          combined.push(c);
        }
      }

      return combined.map((contact: any) => ({
        zohoContactId: contact.contact_id,
        companyName: contact.company_name || contact.contact_name,
        customerName: contact.contact_name,
        email: contact.email || '',
        mobileNumber: contact.mobile || contact.phone || '',
        gstTreatment: contact.gst_treatment || '',
        gstNumber: contact.gst_no || '',
        address: contact.billing_address
          ? `${contact.billing_address.address || ''}\n${contact.billing_address.city || ''}\n${contact.billing_address.state || ''}\n${contact.billing_address.zip || ''}\n${contact.billing_address.country || ''}`.trim()
          : ''
      }));
    } catch (error: any) {
      console.error('Error in searchVendors:', error.message);
      return [];
    }
  }

  public static async getContactDetails(contactId: string): Promise<any> {
    try {
      const accessToken = await this.getAccessToken();
      const orgId = process.env.ZOHO_ORG_ID;
      const apiUrl = process.env.ZOHO_BOOKS_API_URL || 'https://www.zohoapis.com/books/v3';

      if (!orgId) {
        throw new Error('ZOHO_ORG_ID is missing in .env');
      }

      const detailUrl = `${apiUrl}/contacts/${contactId}?organization_id=${orgId}`;
      const response = await fetch(detailUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`Zoho API getContactDetails failed: ${errText}`);
        return null;
      }

      const data: any = await response.json();
      if (!data.contact) {
        return null;
      }

      const contact = data.contact;

      // Billing address formatting
      const billing = contact.billing_address || {};
      const billingAddrStr = [
        billing.address,
        billing.city,
        billing.state,
        billing.zip,
        billing.country
      ].filter(Boolean).join(', ');

      // Shipping address formatting
      const shipping = contact.shipping_address || {};
      const shippingAddrStr = [
        shipping.address,
        shipping.city,
        shipping.state,
        shipping.zip,
        shipping.country
      ].filter(Boolean).join(', ');

      return {
        zohoContactId: contact.contact_id,
        companyName: contact.company_name || contact.contact_name,
        customerName: contact.contact_name,
        email: contact.email || '',
        mobileNumber: contact.mobile || contact.phone || '',
        gstTreatment: contact.gst_treatment || '',
        gstNumber: contact.gst_no || '',
        billingAddress: billingAddrStr || billing.address || '',
        shippingAddress: shippingAddrStr || shipping.address || '',
        billingState: billing.state || '',
        shippingState: shipping.state || ''
      };
    } catch (error: any) {
      console.error('Error in getContactDetails:', error.message);
      return null;
    }
  }

  public static async fetchItems(): Promise<any[]> {
    try {
      const accessToken = await this.getAccessToken();
      const orgId = process.env.ZOHO_ORG_ID;
      const apiUrl = process.env.ZOHO_BOOKS_API_URL || 'https://www.zohoapis.com/books/v3';

      if (!orgId) {
        throw new Error('ZOHO_ORG_ID is missing in .env');
      }

      let allItems: any[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore && page <= 25) { // Fetch up to 5,000 items
        const itemsUrl = `${apiUrl}/items?organization_id=${orgId}&per_page=200&page=${page}`;
        const response = await fetch(itemsUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Zoho-oauthtoken ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const errText = await response.text();
          console.error(`Zoho API fetchItems failed (page ${page}): ${errText}`);
          break;
        }

        const data: any = await response.json();
        if (data.items && data.items.length > 0) {
          allItems.push(...data.items);
        }

        hasMore = data.page_context ? data.page_context.has_more_page : false;
        page++;
      }

      return allItems.map((item: any) => ({
        zohoItemId: item.item_id,
        name: item.name,
        rate: item.rate || 0,
        description: item.description || item.purchase_description || '',
        sku: item.sku || '',
        hsnSac: item.hsn_or_sac || '',
        status: item.status || 'active',
      }));
    } catch (error: any) {
      console.error('Error in fetchItems:', error.message);
      return [];
    }
  }

  public static async searchItems(searchText: string): Promise<any[]> {
    try {
      const accessToken = await this.getAccessToken();
      const orgId = process.env.ZOHO_ORG_ID;
      const apiUrl = process.env.ZOHO_BOOKS_API_URL || 'https://www.zohoapis.com/books/v3';

      if (!orgId) {
        throw new Error('ZOHO_ORG_ID is missing in .env');
      }

      let allItems: any[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore && page <= 25) {
        const searchUrl = `${apiUrl}/items?organization_id=${orgId}&search_text=${encodeURIComponent(searchText)}&per_page=200&page=${page}`;
        const response = await fetch(searchUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Zoho-oauthtoken ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const errText = await response.text();
          console.error(`Zoho API searchItems failed (page ${page}): ${errText}`);
          break;
        }

        const data: any = await response.json();
        if (data.items && data.items.length > 0) {
          allItems.push(...data.items);
        }

        hasMore = data.page_context ? data.page_context.has_more_page : false;
        page++;
      }

      return allItems.map((item: any) => ({
        zohoItemId: item.item_id,
        name: item.name,
        rate: item.rate || 0,
        description: item.description || item.purchase_description || '',
        sku: item.sku || '',
        hsnSac: item.hsn_or_sac || '',
        status: item.status || 'active',
      }));
    } catch (error: any) {
      console.error('Error in searchItems:', error.message);
      return [];
    }
  }
}
