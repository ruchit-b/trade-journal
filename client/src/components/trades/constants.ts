/** Top 50 Nifty 50 symbols for autocomplete */
export const NIFTY_50_SYMBOLS = [
  'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'HINDUNILVR', 'ICICIBANK', 'KOTAKBANK', 'BHARTIARTL', 'ITC', 'SBIN',
  'BAJFINANCE', 'LT', 'AXISBANK', 'ASIANPAINT', 'MARUTI', 'WIPRO', 'TITAN', 'SUNPHARMA', 'ULTRACEMCO', 'NESTLEIND',
  'TATAMOTORS', 'POWERGRID', 'ONGC', 'NTPC', 'INDUSINDBK', 'BAJAJFINSV', 'TECHM', 'HCLTECH', 'DIVISLAB', 'CIPLA',
  'DRREDDY', 'BRITANNIA', 'EICHERMOT', 'ADANIPORTS', 'GRASIM', 'TATASTEEL', 'APOLLOHOSP', 'HEROMOTOCO', 'COALINDIA',
  'JSWSTEEL', 'M&M', 'HINDALCO', 'SBILIFE', 'ADANIENT', 'TATACONSUM', 'BPCL', 'UPL', 'PIDILITIND', 'HDFCLIFE',
  'SHRIRAMFIN',
];

export const SETUP_TYPE_OPTIONS = [
  'Breakout',
  'Pullback',
  'Reversal',
  'Momentum',
  'Range',
  'Gap Up',
  'Gap Down',
  'Earnings Play',
  'VCP',
  'Tight Range',
  '20EMA Pullback',
  'Blue Dot',
  'High Tight Flag',
  'Other',
] as const;

export const SECTOR_OPTIONS = [
  'Nifty IT', 'Banking & Finance', 'FMCG', 'Auto', 'Pharma', 'Energy', 'Metals', 'Realty', 'Media', 'Telecom', 'Other',
] as const;

export const EXIT_REASON_OPTIONS = [
  'Hit SL',
  'Hit Target',
  'Time Stop',
  'Market Weakness',
  'Emotional Exit',
] as const;

export const EXECUTION_GRADE_OPTIONS = [
  'Followed plan',
  'Slight deviation',
  'Luck/Random',
  'Broke rules',
] as const;

export const MARKET_PULSE_OPTIONS = [
  'Trending',
  'Volatile/Chippy',
  'Sideways',
  'Correction',
] as const;

export const EXECUTION_ERROR_OPTIONS = [
  'Chased Entry',
  'Early Exit (Fear)',
  'Late Exit',
  'Wide SL',
  'Ignored VCP criteria',
  'Over-leveraged',
] as const;
