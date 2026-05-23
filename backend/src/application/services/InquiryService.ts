import { Inquiry, InquiryStatus } from '../../domain/entities/Inquiry';
import { CUSTOMER_SERVICE_CATEGORY_VALUES } from '../../constants/customerServiceProducts';
import { InquiryModel } from '../../infrastructure/database/models/InquiryModel';
import { CustomerService } from './CustomerService';
import { ProposalService } from './ProposalService';
import { InteractionService } from './InteractionService';
import { CustomerRequirementService } from './CustomerRequirementService';
import { BillingService } from './BillingService';
import { PaymentNotificationService } from './PaymentNotificationService';
import { InvoiceService } from './InvoiceService';
import { buildInvoicePdfPublicUrl } from '../../infrastructure/security/invoicePublicLink';
import { ProjectService } from './ProjectService';
import { PaymentPlanService } from './PaymentPlanService';

export interface CreateInquiryInput {
  customerName: string;
  companyName?: string;
  phoneNumber: string;
  businessModel?: string;
  projectDescription?: string;
  requiredFeatures: string[];
  internalNotes?: string;
  createdBy?: string;
  dateOfBirth?: string;
}

export interface UpdateInquiryInput {
  customerName?: string;
  companyName?: string;
  phoneNumber?: string;
  businessModel?: string;
  projectDescription?: string;
  requiredFeatures?: string[];
  internalNotes?: string;
  status?: InquiryStatus;
  dateOfBirth?: string;
}

export class InquiryService {
  private customerService = new CustomerService();
  private proposalService = new ProposalService();
  private interactionService = new InteractionService();
  private customerRequirementService = new CustomerRequirementService();
  private billingService = new BillingService();
  private paymentNotificationService = new PaymentNotificationService();
  private invoiceService = new InvoiceService();
  private projectService = new ProjectService();
  private paymentPlanService = new PaymentPlanService();

  async create(data: CreateInquiryInput): Promise<{ inquiry: Inquiry; duplicatePhone: boolean }> {
    const normalizedPhone = this.normalizePhone(data.phoneNumber);
    const existing = await InquiryModel.findOne({ phoneNumber: normalizedPhone });
    const duplicatePhone = !!existing;

    const inquiry = await InquiryModel.create({
      ...data,
      companyName: data.companyName?.trim() || undefined,
      phoneNumber: normalizedPhone,
      projectDescription: (data.projectDescription ?? '').trim(),
      requiredFeatures: data.requiredFeatures ?? [],
      businessModel: data.businessModel?.trim() || undefined,
      dateOfBirth: data.dateOfBirth?.trim() || undefined,
      status: 'NEW' as InquiryStatus,
      createdBy: data.createdBy,
    });

    return {
      inquiry: inquiry.toObject() as unknown as Inquiry,
      duplicatePhone,
    };
  }

  async findById(id: string): Promise<Inquiry | null> {
    const doc = await InquiryModel.findById(id);
    return doc ? (doc.toObject() as unknown as Inquiry) : null;
  }

  async findAll(filters?: { status?: InquiryStatus; search?: string }): Promise<Inquiry[]> {
    const query: Record<string, unknown> = {};

    if (filters?.status) {
      query.status = filters.status;
    }

    if (filters?.search) {
      const searchRegex = { $regex: filters.search, $options: 'i' };
      query.$or = [
        { customerName: searchRegex },
        { companyName: searchRegex },
        { phoneNumber: searchRegex },
        { projectDescription: searchRegex },
        { businessModel: searchRegex },
      ];
    }

    const docs = await InquiryModel.find(query).sort({ createdAt: -1 });
    return docs.map((d) => d.toObject() as unknown as Inquiry);
  }

  async update(id: string, data: UpdateInquiryInput): Promise<Inquiry | null> {
    const update: Record<string, unknown> = { ...data };
    if (data.companyName !== undefined) update.companyName = data.companyName?.trim() || undefined;
    if (data.phoneNumber) update.phoneNumber = this.normalizePhone(data.phoneNumber);
    if (data.businessModel !== undefined) {
      update.businessModel = data.businessModel?.trim() || undefined;
    }
    if (data.dateOfBirth !== undefined) update.dateOfBirth = data.dateOfBirth?.trim() || undefined;
    const doc = await InquiryModel.findByIdAndUpdate(id, update, { new: true, runValidators: false });
    const inquiry = doc ? (doc.toObject() as unknown as Inquiry) : null;
    if (inquiry && (data.status === 'PENDING_ADVANCE' || data.status === 'CONFIRMED')) {
      let customer = await this.customerService.findByInquiryId(String(inquiry._id));
      if (!customer) {
        // Prefer Project Titles stored in inquiry's proposals array (same as Proposal tab's Project Name)
        const fromInquiry = (inquiry.proposals || [])
          .map((p) => p.projectName)
          .filter((t): t is string => Boolean(t));
        let projectTitles = [...new Set(fromInquiry)];
        if (projectTitles.length === 0) {
          const proposals = await this.proposalService.findAllByInquiryId(String(inquiry._id));
          projectTitles = [...new Set(
            proposals.map((p) => p.projectName).filter((t): t is string => Boolean(t))
          )];
        }
        const projects = projectTitles.length > 0
          ? projectTitles
          : [inquiry.projectDescription].filter(Boolean);
        const serviceCategories = this.identifyServiceCategories(inquiry);
        customer = await this.customerService.create({
          name: inquiry.customerName,
          phoneNumber: inquiry.phoneNumber,
          projects,
          inquiryId: String(inquiry._id),
          companyName: inquiry.companyName?.trim() || undefined,
          serviceCategories,
        });
        await this.interactionService.create({
          customerRef: String(customer._id),
          inquiryRef: String(inquiry._id),
          type: 'STATUS_CHANGE',
          summary: 'Deal confirmed — pending advance payment; customer profile created',
          details: inquiry.internalNotes || inquiry.projectDescription,
          occurredAt: new Date(),
        });
        const reqItems = (inquiry.requiredFeatures || []).filter(Boolean);
        await Promise.all(
          reqItems.map((feature) =>
            this.customerRequirementService.create({
              customerRef: String(customer!._id),
              inquiryRef: String(inquiry._id),
              title: feature,
              description: inquiry.projectDescription,
              source: 'INQUIRY',
              priority: 'MEDIUM',
              status: 'OPEN',
            })
          )
        );
      }
      await this.ensureAdvanceBillingOnConfirmation(inquiry, customer);
      await this.ensureProjectAndPrimaryPaymentPlanFromProposal(inquiry, customer);
      await this.proposalService.syncLatestProposalConfirmedForInquiry(String(inquiry._id));
    }
    return inquiry;
  }

  async delete(id: string): Promise<boolean> {
    const result = await InquiryModel.findByIdAndDelete(id);
    return !!result;
  }

  async checkDuplicatePhone(phoneNumber: string, excludeId?: string): Promise<boolean> {
    const normalized = this.normalizePhone(phoneNumber);
    const query: { phoneNumber: string; _id?: { $ne: unknown } } = { phoneNumber: normalized };
    if (excludeId) query._id = { $ne: excludeId } as { $ne: unknown };
    const existing = await InquiryModel.findOne(query);
    return !!existing;
  }

  private normalizePhone(phone: string): string {
    return phone.replace(/\D/g, '').trim() || phone.trim();
  }

  /**
   * On confirmation, create the 40% advance invoice from the latest proposal.
   * Idempotent: creates at most one ADVANCE bill per inquiry.
   */
  private async ensureAdvanceBillingOnConfirmation(inquiry: Inquiry, customer: { _id?: string } | null): Promise<void> {
    if (!inquiry._id) return;
    const inquiryId = String(inquiry._id);

    const proposal = await this.proposalService.findByInquiryId(inquiryId);
    if (!proposal) return;
    const advance = Number(proposal.advancePayment ?? 0);
    if (!Number.isFinite(advance) || advance <= 0) return;

    const projectLabel = proposal.projectName?.trim() || inquiry.projectDescription?.trim() || 'Project';
    const latestAdvanceInvoice = await this.invoiceService.findProposalAdvanceByInquiryId(inquiryId);
    const needsNewBilling = !latestAdvanceInvoice || latestAdvanceInvoice.status === 'paid';

    let billing: { billingId: string } | null = null;
    if (needsNewBilling) {
      billing = await this.billingService.create({
        inquiryId,
        customerName: inquiry.customerName,
        companyName: inquiry.companyName?.trim() || undefined,
        projectName: proposal.projectName?.trim() || undefined,
        phoneNumber: inquiry.phoneNumber,
        billingType: 'ADVANCE',
        items: [
          {
            number: '1',
            description: `Advance payment (40%) - ${projectLabel}`,
            amount: advance,
          },
        ],
        subTotal: advance,
        advanceApplied: 0,
        totalAmount: advance,
        billingDate: new Date(),
      });
    }

    // Create invoice record from proposal advance (same amount as billing); link client + shop (companyName) + proposal for finance.
    let advanceInvoiceNumber: string | undefined;
    let advanceInvoiceId: string | undefined;
    if (customer?._id && proposal._id) {
      const invoice = await this.invoiceService.ensureProposalAdvanceInvoice({
        inquiryId,
        proposalId: String(proposal._id),
        clientId: String(customer._id),
        advanceAmount: advance,
        projectLabel,
        companyName: inquiry.companyName?.trim() || undefined,
        projectName: proposal.projectName?.trim() || undefined,
      });
      if (invoice?._id) {
        advanceInvoiceId = invoice._id;
        advanceInvoiceNumber = invoice.invoiceNumber;
      }
    }

    // Queue immediate customer communication that advance invoice is generated.
    if (customer?._id) {
      const invoiceLabel = advanceInvoiceNumber || billing?.billingId || 'Advance Invoice';
      const pdfUrl = advanceInvoiceId ? buildInvoicePdfPublicUrl(advanceInvoiceId) : '';
      const displayName = inquiry.customerName || 'Valued customer';
      const amountStr = `LKR ${Number(advance).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      const invLine = advanceInvoiceNumber || invoiceLabel;
      const desc = `Advance Payment (40%) for ${projectLabel}`;
      const emailBody = [
        `Dear ${displayName},`,
        '',
        `Thank you for choosing Niolla Nexa.`,
        '',
        `Your invoice ${invLine} is ready.`,
        `Details: ${desc}`,
        `Amount due: ${amountStr} (status: Pending).`,
        '',
        pdfUrl ? `Download your official PDF invoice here:\n${pdfUrl}` : 'Your invoice PDF will be available from our team shortly.',
        '',
        'If you have any questions, contact us with this invoice number.',
        '',
        'Best regards,',
        'Niolla Nexa',
      ].join('\n');
      const smsBody = pdfUrl
        ? `Niolla Nexa: Invoice ${invLine} — ${amountStr}. Download PDF: ${pdfUrl}`
        : `Niolla Nexa: Invoice ${invLine} — ${amountStr}. Status: Pending.`;
      await Promise.all([
        this.paymentNotificationService.create({
          clientId: String(customer._id),
          type: 'email',
          triggerType: 'receipt',
          scheduledAt: new Date(),
          messageBody: emailBody,
        }),
        this.paymentNotificationService.create({
          clientId: String(customer._id),
          type: 'sms',
          triggerType: 'receipt',
          scheduledAt: new Date(),
          messageBody: smsBody,
        }),
      ]);
    }
  }

  /**
   * Create (or reuse) the delivery project and a primary payment plan + installments from the latest proposal
   * so Payments / Installments / customer billing align with the confirmed deal.
   */
  private async ensureProjectAndPrimaryPaymentPlanFromProposal(
    inquiry: Inquiry,
    customer: { _id?: string } | null
  ): Promise<void> {
    if (!inquiry._id || !customer?._id) return;
    const inquiryId = String(inquiry._id);
    const proposal = await this.proposalService.findByInquiryId(inquiryId);
    if (!proposal || !Number.isFinite(Number(proposal.totalAmount)) || Number(proposal.totalAmount) <= 0) return;

    const projectName =
      (proposal.projectName || inquiry.projectDescription || 'Project').trim() || 'Project';
    const clientId = String(customer._id);

    const existingProjects = await this.projectService.findByClientId(clientId);
    const match = existingProjects.find((p) => p.projectName.trim() === projectName.trim());
    let projectId: string;
    if (match?._id) {
      projectId = match._id;
      await this.projectService.update(projectId, { totalValue: Number(proposal.totalAmount) });
    } else {
      const created = await this.projectService.create({
        clientId,
        projectName,
        description: proposal.projectDescription || inquiry.projectDescription || undefined,
        totalValue: Number(proposal.totalAmount),
        status: 'unassigned',
      });
      if (!created._id) return;
      projectId = created._id;
    }

    await this.paymentPlanService.createPrimaryPlanFromProposal({
      projectId,
      totalAmount: Number(proposal.totalAmount),
      advancePayment: Number(proposal.advancePayment ?? 0),
      installmentMonths: Number(proposal.installmentMonths ?? 0),
      monthlyInstallment:
        proposal.monthlyInstallment !== undefined && proposal.monthlyInstallment !== null
          ? Number(proposal.monthlyInstallment)
          : undefined,
    });
  }

  /**
   * Prospect conversion helper:
   * infer product/service categories from inquiry text so customer profile
   * starts with likely services (for filtering like "POS customers").
   */
  private identifyServiceCategories(inquiry: Inquiry): string[] {
    const values = new Set<string>();
    const text = [
      inquiry.businessModel,
      inquiry.projectDescription,
      inquiry.internalNotes,
      ...(inquiry.requiredFeatures || []),
      ...((inquiry.proposals || []).map((p) => p.projectName).filter(Boolean) as string[]),
    ]
      .join(' ')
      .toLowerCase();

    const has = (...patterns: RegExp[]) => patterns.some((p) => p.test(text));

    if (has(/\bpos\b/, /\bpoint\s*of\s*sale\b/, /\bcashier\b/, /\bbilling\s*counter\b/)) values.add('POS');
    if (has(/\berp\b/, /\benterprise\s*resource\s*planning\b/, /\binventory\b/, /\bprocurement\b/)) values.add('ERP');
    if (has(/\bwebsite\b/, /\bweb\s*site\b/, /\bweb\s*app\b/, /\blanding\s*page\b/)) values.add('Website');
    if (has(/\bmobile\b/, /\bandroid\b/, /\bios\b/, /\bflutter\b/, /\breact\s*native\b/, /\bapp\b/)) values.add('Mobile App');
    if (has(/\be-?commerce\b/, /\bonline\s*store\b/, /\bshopping\s*cart\b/, /\bcheckout\b/)) values.add('E-Commerce');
    if (has(/\bcrm\b/, /\bcustomer\s*relationship\b/, /\blead\s*management\b/, /\bpipeline\b/)) values.add('CRM');

    // If we captured software intent but no named product line, keep a broad bucket.
    if (
      values.size === 0 &&
      has(/\bsoftware\b/, /\bsystem\b/, /\bautomation\b/, /\bportal\b/, /\bdashboard\b/, /\bapplication\b/)
    ) {
      values.add('Custom Software');
    }

    const allowed = new Set<string>(CUSTOMER_SERVICE_CATEGORY_VALUES as readonly string[]);
    return [...values].filter((v) => allowed.has(v));
  }
}
