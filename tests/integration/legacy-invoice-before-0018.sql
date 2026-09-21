\set ON_ERROR_STOP on

insert into public.invoices (
  debtor_public_key, issuer_public_key, asset_code, asset_issuer, amount, memo, due_at
) values (
  'GAC7JSXMBOC5F2MOE7NT3VC3YLSQRKVS2OGF3PWLOSHX3QWPAG2RZ4OY',
  'GDTTX5V34X5BFL74VTHDU2W2555DYASROG2O23DNP3SKF3EUCK6FAHBH',
  'BRLT', 'GDTTX5V34X5BFL74VTHDU2W2555DYASROG2O23DNP3SKF3EUCK6FAHBH',
  7.0000000, 'legacy-before-0018', now() + interval '1 day'
);
