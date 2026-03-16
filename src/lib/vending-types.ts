// Vending Lead - represents a business lead
export interface VendingLead {
  id: string;
  created_at: Date;
  batch_date: string;
  business_name: string;
  vertical: string;
  address?: string;
  city: string;
  state: string;
  phone?: string;
  email?: string;
  contact_name?: string;
  website?: string;
  size_indicator?: 'Small' | 'Medium' | 'Large';
  scout_notes?: string;
  status: 'raw' | 'qualified' | 'discarded';
  score?: number;
  tier?: 'A' | 'B' | 'C' | 'D';
  score_breakdown?: Record<string, any>;
  qualifier_notes?: string;
  updated_at: Date;
}

// Outreach - tracks the email sequence for each lead
export interface VendingOutreach {
  id: string;
  lead_id: string;
  status: 'draft' | 'pending_approval' | 'approved' | 'active' | 'replied' | 'closed_won' | 'closed_lost' | 'unresponsive';
  first_contact_subject?: string;
  first_contact_body?: string;
  first_contact_sent_at?: Date;
  f1_sent_at?: Date;
  f2_sent_at?: Date;
  f3_sent_at?: Date;
  reply_received_at?: Date;
  reply_summary?: string;
  approved_at?: Date;
  created_at: Date;
  updated_at: Date;
}

// Joined outreach with lead data
export interface VendingOutreachWithLead extends VendingOutreach {
  lead: VendingLead;
}

// Placement - leads that have entered deal stage
export interface VendingPlacement {
  id: string;
  lead_id: string;
  status: 'pipeline' | 'closed_won' | 'closed_lost';
  meeting_date?: Date;
  placement_date?: string;
  location_details?: string;
  agreement_summary?: string;
  lost_reason?: string;
  notes?: string;
  created_at: Date;
  updated_at: Date;
}

// Joined placement with lead data
export interface VendingPlacementWithLead extends VendingPlacement {
  lead: VendingLead;
}

// Aggregated stats
export interface VendingStats {
  leadsThisWeek: number;
  aTierCount: number;
  bTierCount: number;
  discardedCount: number;
  outreachSentThisWeek: number;
  pendingApprovalCount: number;
  activeSequencesCount: number;
  replyCount: number;
  replyRate: number;
  meetingsBooked: number;
  placementsClosedWon: number;
}
