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

  private static cachedContacts: any[] = [];
  private static cachedVendors: any[] = [];
  private static cachedItems: any[] = [];
  private static lastCacheTime: number = 0;
  private static isSyncingCache: boolean = false;

  /** Pre-fetch and cache all contacts, vendors, and items in background */
  public static async refreshCacheIfNeeded(force: boolean = false): Promise<void> {
    const now = Date.now();
    if (!force && this.lastCacheTime > 0 && (now - this.lastCacheTime < 300000)) {
      return; // Cache valid for 5 minutes
    }
    if (this.isSyncingCache) return;

    this.isSyncingCache = true;
    try {
      const accessToken = await this.getAccessToken();
      const orgId = process.env.ZOHO_ORG_ID;
      const apiUrl = process.env.ZOHO_BOOKS_API_URL || 'https://www.zohoapis.com/books/v3';
      if (!orgId) return;

      // 1. Fetch Contacts
      let contacts: any[] = [];
      let page = 1;
      let hasMore = true;
      while (hasMore && page <= 10) {
        const res = await fetch(`${apiUrl}/contacts?organization_id=${orgId}&per_page=200&page=${page}`, {
          headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}`, 'Content-Type': 'application/json' }
        });
        if (!res.ok) break;
        const data: any = await res.json();
        if (data.contacts && data.contacts.length > 0) contacts.push(...data.contacts);
        hasMore = data.page_context ? data.page_context.has_more_page : false;
        page++;
      }

      // Filter customers and vendors
      this.cachedContacts = contacts.filter((c: any) => c.contact_type === 'customer' || c.contact_type === 'all' || !c.contact_type).map((c: any) => ({
        zohoContactId: c.contact_id,
        companyName: c.company_name || c.contact_name,
        customerName: c.contact_name,
        email: c.email || '',
        mobileNumber: c.mobile || c.phone || '',
        gstTreatment: c.gst_treatment || '',
        gstNumber: c.gst_no || '',
        address: c.billing_address ? `${c.billing_address.address || ''} ${c.billing_address.city || ''} ${c.billing_address.state || ''} ${c.billing_address.zip || ''}`.trim() : ''
      }));

      this.cachedVendors = contacts.filter((c: any) => c.contact_type === 'vendor' || c.contact_type === 'all').map((c: any) => ({
        zohoContactId: c.contact_id,
        companyName: c.company_name || c.contact_name,
        customerName: c.contact_name,
        email: c.email || '',
        mobileNumber: c.mobile || c.phone || '',
        gstTreatment: c.gst_treatment || '',
        gstNumber: c.gst_no || '',
        address: c.billing_address ? `${c.billing_address.address || ''} ${c.billing_address.city || ''} ${c.billing_address.state || ''} ${c.billing_address.zip || ''}`.trim() : ''
      }));

      this.lastCacheTime = Date.now();
      console.log(`[ZohoService] Cache refreshed successfully: ${this.cachedContacts.length} customers, ${this.cachedVendors.length} vendors.`);
    } catch (err: any) {
      console.error('[ZohoService] Error refreshing cache:', err.message);
    } finally {
      this.isSyncingCache = false;
    }
  }

  public static async searchContacts(searchText: string): Promise<any[]> {
    try {
      // Trigger background cache refresh
      this.refreshCacheIfNeeded();

      const query = searchText.trim().toLowerCase();
      if (!query) {
        if (this.cachedContacts.length > 0) return this.cachedContacts;
      }

      // Fast in-memory search across cache
      const cachedMatches = this.cachedContacts.filter(c =>
        c.companyName.toLowerCase().includes(query) ||
        c.customerName.toLowerCase().includes(query) ||
        c.mobileNumber.toLowerCase().includes(query) ||
        c.email.toLowerCase().includes(query) ||
        c.gstNumber.toLowerCase().includes(query) ||
        c.address.toLowerCase().includes(query)
      );

      // Perform live Zoho API query to ensure 100% complete results
      const accessToken = await this.getAccessToken();
      const orgId = process.env.ZOHO_ORG_ID;
      const apiUrl = process.env.ZOHO_BOOKS_API_URL || 'https://www.zohoapis.com/books/v3';

      if (!orgId) return cachedMatches;

      let allContacts: any[] = [];
      const trimmedSearch = searchText.trim();

      if (trimmedSearch) {
        const upper = trimmedSearch.toUpperCase();
        const lower = trimmedSearch.toLowerCase();
        const title = trimmedSearch.charAt(0).toUpperCase() + trimmedSearch.slice(1).toLowerCase();
        const variations = Array.from(new Set([trimmedSearch, upper, title, lower]));

        let page = 1;
        let hasMore = true;

        while (hasMore && page <= 3) {
          const fetchPromises: Promise<Response>[] = [];
          for (const v of variations) {
            const encodedVar = encodeURIComponent(v);
            fetchPromises.push(
              fetch(`${apiUrl}/contacts?organization_id=${orgId}&company_name_contains=${encodedVar}&per_page=200&page=${page}`, { headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}`, 'Content-Type': 'application/json' } }),
              fetch(`${apiUrl}/contacts?organization_id=${orgId}&contact_name_contains=${encodedVar}&per_page=200&page=${page}`, { headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}`, 'Content-Type': 'application/json' } }),
              fetch(`${apiUrl}/contacts?organization_id=${orgId}&search_text=${encodedVar}&per_page=200&page=${page}`, { headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}`, 'Content-Type': 'application/json' } })
            );
          }

          const responses = await Promise.all(fetchPromises);
          let anyHasMore = false;

          for (const res of responses) {
            if (res.ok) {
              const data: any = await res.json();
              if (data.contacts && data.contacts.length > 0) {
                allContacts.push(...data.contacts);
              }
              if (data.page_context && data.page_context.has_more_page) {
                anyHasMore = true;
              }
            }
          }

          hasMore = anyHasMore;
          page++;
        }
      }

      // Map live API results
      const liveMapped = allContacts.map((contact: any) => ({
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

      // Merge cached matches and live API matches, deduplicate by zohoContactId
      const seen = new Set<string>();
      const combined: any[] = [];

      for (const item of [...cachedMatches, ...liveMapped]) {
        if (!seen.has(item.zohoContactId)) {
          seen.add(item.zohoContactId);
          combined.push(item);
        }
      }

      return combined;
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

      let allContacts: any[] = [];
      const trimmedSearch = searchText.trim();
      const upper = trimmedSearch.toUpperCase();
      const lower = trimmedSearch.toLowerCase();
      const title = trimmedSearch.charAt(0).toUpperCase() + trimmedSearch.slice(1).toLowerCase();
      const variations = Array.from(new Set([trimmedSearch, upper, title, lower]));

      let page = 1;
      let hasMore = true;

      while (hasMore && page <= 5) {
        const fetchPromises: Promise<Response>[] = [];
        for (const v of variations) {
          const encodedVar = encodeURIComponent(v);
          fetchPromises.push(
            fetch(`${apiUrl}/contacts?organization_id=${orgId}&contact_type=vendor&company_name_contains=${encodedVar}&per_page=200&page=${page}`, { headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}`, 'Content-Type': 'application/json' } }),
            fetch(`${apiUrl}/contacts?organization_id=${orgId}&contact_type=vendor&contact_name_contains=${encodedVar}&per_page=200&page=${page}`, { headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}`, 'Content-Type': 'application/json' } })
          );
        }

        const responses = await Promise.all(fetchPromises);
        let anyHasMore = false;

        for (const res of responses) {
          if (res.ok) {
            const data: any = await res.json();
            if (data.contacts && data.contacts.length > 0) {
              allContacts.push(...data.contacts);
            }
            if (data.page_context && data.page_context.has_more_page) {
              anyHasMore = true;
            }
          }
        }

        hasMore = anyHasMore;
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

  public static async createContact(customerData: any): Promise<any> {
    try {
      const accessToken = await this.getAccessToken();
      const orgId = process.env.ZOHO_ORG_ID;
      const apiUrl = process.env.ZOHO_BOOKS_API_URL || 'https://www.zohoapis.com/books/v3';
      if (!orgId) return null;

      const payload = {
        contact_name: customerData.customerName || customerData.companyName,
        company_name: customerData.companyName,
        phone: customerData.mobileNumber || '',
        mobile: customerData.mobileNumber || '',
        email: customerData.email || '',
        gst_no: customerData.gstNumber || '',
        gst_treatment: customerData.gstNumber ? 'business_gst' : 'consumer',
        billing_address: {
          address: customerData.billingAddress || customerData.address || '',
          state: customerData.billingState || ''
        },
        shipping_address: {
          address: customerData.shippingAddress || customerData.address || '',
          state: customerData.shippingState || ''
        }
      };

      const res = await fetch(`${apiUrl}/contacts?organization_id=${orgId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.text();
        console.warn('[ZohoService] Failed to create contact in Zoho Books:', err);
        return null;
      }

      const data: any = await res.json();
      if (data.contact) {
        console.log(`[ZohoService] Created contact "${data.contact.company_name}" in Zoho Books (ID: ${data.contact.contact_id})`);
        // Refresh cache asynchronously
        this.refreshCacheIfNeeded(true);
        return data.contact;
      }
      return null;
    } catch (err: any) {
      console.error('[ZohoService] createContact error:', err.message);
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

      const trimmedSearch = searchText.trim();
      if (!trimmedSearch) {
        return this.fetchItems();
      }

      let allItems: any[] = [];
      const upper = trimmedSearch.toUpperCase();
      const lower = trimmedSearch.toLowerCase();
      const title = trimmedSearch.charAt(0).toUpperCase() + trimmedSearch.slice(1).toLowerCase();
      const variations = Array.from(new Set([trimmedSearch, upper, title, lower]));

      let page = 1;
      let hasMore = true;

      while (hasMore && page <= 5) {
        const fetchPromises: Promise<Response>[] = [];
        for (const v of variations) {
          const encodedVar = encodeURIComponent(v);
          fetchPromises.push(
            fetch(`${apiUrl}/items?organization_id=${orgId}&name_contains=${encodedVar}&per_page=200&page=${page}`, { headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}`, 'Content-Type': 'application/json' } }),
            fetch(`${apiUrl}/items?organization_id=${orgId}&sku_contains=${encodedVar}&per_page=200&page=${page}`, { headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}`, 'Content-Type': 'application/json' } })
          );
        }

        const responses = await Promise.all(fetchPromises);
        let anyHasMore = false;

        for (const res of responses) {
          if (res.ok) {
            const data: any = await res.json();
            if (data.items && data.items.length > 0) {
              allItems.push(...data.items);
            }
            if (data.page_context && data.page_context.has_more_page) {
              anyHasMore = true;
            }
          }
        }

        hasMore = anyHasMore;
        page++;
      }

      // Merge & deduplicate by item_id
      const seen = new Set<string>();
      const combined: any[] = [];
      for (const item of allItems) {
        if (!seen.has(item.item_id)) {
          seen.add(item.item_id);
          combined.push(item);
        }
      }

      return combined.map((item: any) => ({
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
