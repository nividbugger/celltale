const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
]
const TENS = [
  '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety',
]

function twoDigitsToWords(n: number): string {
  if (n < 20) return ONES[n]
  const tens = Math.floor(n / 10)
  const ones = n % 10
  return ones ? `${TENS[tens]} ${ONES[ones]}` : TENS[tens]
}

function threeDigitsToWords(n: number): string {
  const hundreds = Math.floor(n / 100)
  const rest = n % 100
  const parts: string[] = []
  if (hundreds) parts.push(`${ONES[hundreds]} Hundred`)
  if (rest) parts.push(twoDigitsToWords(rest))
  return parts.join(' ')
}

// Indian numbering: crore / lakh / thousand / hundred
function integerToWordsIndian(n: number): string {
  if (n === 0) return 'Zero'
  const crore = Math.floor(n / 1_00_00_000)
  const lakh = Math.floor((n % 1_00_00_000) / 1_00_000)
  const thousand = Math.floor((n % 1_00_000) / 1_000)
  const hundred = n % 1_000

  const parts: string[] = []
  if (crore) parts.push(`${threeDigitsToWords(crore)} Crore`)
  if (lakh) parts.push(`${threeDigitsToWords(lakh)} Lakh`)
  if (thousand) parts.push(`${threeDigitsToWords(thousand)} Thousand`)
  if (hundred) parts.push(threeDigitsToWords(hundred))
  return parts.join(' ')
}

export function amountInWordsINR(amount: number): string {
  const rupees = Math.floor(Math.round(amount * 100) / 100)
  const paise = Math.round((amount - rupees) * 100)

  const rupeeWords = `${integerToWordsIndian(rupees)} Rupees`
  if (paise > 0) {
    return `${rupeeWords} and ${twoDigitsToWords(paise)} Paise only`
  }
  return `${rupeeWords} only`
}
