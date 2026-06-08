import { Router } from 'express';
import { param, query, validationResult } from 'express-validator';
import { authMiddleware, requireCompanyFinancials, requireRole } from '../middleware/auth';
import {
  getPaymentSummary,
  getMonthlyCollection,
  getOverdueList,
  getIncomeTracking,
  getLiveBusinessBalance,
  getFinanceLedger,
  downloadMonthlyProfitLoss,
  getProjectFinancialSheet,
  downloadProjectFinancialSheet,
  getFinancialIncomeReport,
  getFinancialExpenseReport,
  getFinancialProfitLossReport,
  downloadFinancialIncomeReport,
  downloadFinancialExpenseReport,
  getProjectProgressReport,
  getStaffPerformanceReport,
  getMarketingRoiReport,
  downloadProjectProgressReport,
  downloadStaffPerformanceReport,
  downloadMarketingRoiReport,
  getTransactionsReport,
  downloadTransactionsReport,
  getStaffWalletReport,
  downloadStaffWalletReport,
  getClientStatement,
  downloadClientStatement,
  getProductProfitabilityReport,
  getProductCustomerDensityReport,
  getProductSalesTrendsReport,
  getTopProductsLeaderboard,
} from '../controllers/ReportController';

const router = Router();
router.use(authMiddleware);
router.use((req: import('../middleware/auth').AuthenticatedRequest, res, next) => {
  if (req.user?.role === 'employee') {
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Reports are not available for developer accounts' },
    });
    return;
  }
  next();
});

const validate = (req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: errors.array()[0].msg, details: errors.array() },
    });
  }
  next();
};

router.get('/summary', getPaymentSummary);
router.get('/live-business-balance', requireCompanyFinancials, getLiveBusinessBalance);
router.get(
  '/finance-ledger',
  requireCompanyFinancials,
  [
    query('from').optional().isISO8601().withMessage('from must be a valid date'),
    query('to').optional().isISO8601().withMessage('to must be a valid date'),
    query('kind').optional().isIn(['all', 'income', 'expense']),
  ],
  validate,
  getFinanceLedger
);
router.get('/income-tracking', getIncomeTracking);
router.get('/monthly-collection', [query('year').isInt({ min: 2020, max: 2100 }), query('month').isInt({ min: 1, max: 12 })], validate, getMonthlyCollection);
router.get('/overdue-list', getOverdueList);
router.get(
  '/financial/income',
  requireRole('owner'),
  [
    query('year').optional().isInt({ min: 2020, max: 2100 }),
    query('month').optional().isInt({ min: 1, max: 12 }),
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
  ],
  validate,
  getFinancialIncomeReport
);
router.get(
  '/financial/expenses',
  requireRole('owner'),
  [
    query('year').optional().isInt({ min: 2020, max: 2100 }),
    query('month').optional().isInt({ min: 1, max: 12 }),
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
  ],
  validate,
  getFinancialExpenseReport
);
router.get(
  '/financial/pl',
  requireRole('owner'),
  [
    query('year').optional().isInt({ min: 2020, max: 2100 }),
    query('month').optional().isInt({ min: 1, max: 12 }),
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
  ],
  validate,
  getFinancialProfitLossReport
);
router.get(
  '/financial/income/download',
  requireRole('owner'),
  [
    query('year').optional().isInt({ min: 2020, max: 2100 }),
    query('month').optional().isInt({ min: 1, max: 12 }),
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
  ],
  validate,
  downloadFinancialIncomeReport
);
router.get(
  '/financial/expenses/download',
  requireRole('owner'),
  [
    query('year').optional().isInt({ min: 2020, max: 2100 }),
    query('month').optional().isInt({ min: 1, max: 12 }),
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
  ],
  validate,
  downloadFinancialExpenseReport
);
router.get(
  '/monthly-profit-loss/download',
  requireRole('owner'),
  [
    query('year').optional().isInt({ min: 2020, max: 2100 }),
    query('month').optional().isInt({ min: 1, max: 12 }),
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
  ],
  validate,
  downloadMonthlyProfitLoss
);
router.get(
  '/project-financial/:projectId',
  requireRole('owner'),
  [param('projectId').isMongoId()],
  validate,
  getProjectFinancialSheet
);
router.get(
  '/project-financial/:projectId/download',
  requireRole('owner'),
  [param('projectId').isMongoId()],
  validate,
  downloadProjectFinancialSheet
);
router.get('/project-progress', requireRole('owner', 'pm'), getProjectProgressReport);
router.get('/staff-performance', requireRole('owner', 'pm'), getStaffPerformanceReport);
router.get(
  '/marketing-roi',
  requireRole('owner', 'pm'),
  [query('from').optional().isISO8601(), query('to').optional().isISO8601()],
  validate,
  getMarketingRoiReport
);
router.get('/project-progress/download', requireRole('owner', 'pm'), downloadProjectProgressReport);
router.get('/staff-performance/download', requireRole('owner', 'pm'), downloadStaffPerformanceReport);
router.get(
  '/marketing-roi/download',
  requireRole('owner', 'pm'),
  [query('from').optional().isISO8601(), query('to').optional().isISO8601()],
  validate,
  downloadMarketingRoiReport
);
router.get(
  '/transactions',
  requireRole('owner'),
  [
    query('year').optional().isInt({ min: 2020, max: 2100 }),
    query('month').optional().isInt({ min: 1, max: 12 }),
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
  ],
  validate,
  getTransactionsReport
);
router.get(
  '/transactions/download',
  requireRole('owner'),
  [
    query('year').optional().isInt({ min: 2020, max: 2100 }),
    query('month').optional().isInt({ min: 1, max: 12 }),
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
  ],
  validate,
  downloadTransactionsReport
);
router.get(
  '/staff-wallet',
  requireRole('owner', 'pm'),
  [
    query('year').optional().isInt({ min: 2020, max: 2100 }),
    query('month').optional().isInt({ min: 1, max: 12 }),
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
  ],
  validate,
  getStaffWalletReport
);
router.get(
  '/staff-wallet/download',
  requireRole('owner', 'pm'),
  [
    query('year').optional().isInt({ min: 2020, max: 2100 }),
    query('month').optional().isInt({ min: 1, max: 12 }),
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
  ],
  validate,
  downloadStaffWalletReport
);
router.get(
  '/client-statement/:clientId',
  requireRole('owner'),
  [param('clientId').isMongoId()],
  validate,
  getClientStatement
);
router.get(
  '/client-statement/:clientId/download',
  requireRole('owner'),
  [param('clientId').isMongoId()],
  validate,
  downloadClientStatement
);

router.get(
  '/products/profitability',
  requireRole('owner', 'pm'),
  [
    query('year').optional().isInt({ min: 2020, max: 2100 }),
    query('month').optional().isInt({ min: 1, max: 12 }),
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
    query('productId').optional().isMongoId(),
  ],
  validate,
  getProductProfitabilityReport
);
router.get(
  '/products/customer-density',
  requireRole('owner'),
  [query('productId').optional().isMongoId()],
  validate,
  getProductCustomerDensityReport
);
router.get(
  '/products/sales-trends',
  requireRole('owner'),
  [query('months').optional().isInt({ min: 3, max: 24 })],
  validate,
  getProductSalesTrendsReport
);
router.get('/products/top-leaderboard', requireRole('owner'), getTopProductsLeaderboard);

export default router;
