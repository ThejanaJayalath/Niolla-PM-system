import { connectDatabase } from '../src/infrastructure/database/mongo';
import { ProposalTemplateModel } from '../src/infrastructure/database/models/ProposalTemplateModel';
import { prepareBundledProposalTemplate } from '../src/infrastructure/pdf/prepareProposalTemplate';
import { getBundledProposalTemplatePath } from '../src/infrastructure/pdf/proposalTemplatePaths';

async function main(): Promise<void> {
  const buffer = prepareBundledProposalTemplate();
  console.log(`Prepared proposal template (${buffer.length} bytes) at:`);
  console.log(getBundledProposalTemplatePath());

  try {
    await connectDatabase();
    const { deletedCount } = await ProposalTemplateModel.deleteMany({});
    if (deletedCount > 0) {
      console.log(`Removed ${deletedCount} custom template override(s). Using sample template for proposals.`);
    }
  } catch (err) {
    console.warn('Could not clear uploaded template overrides:', (err as Error).message);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
