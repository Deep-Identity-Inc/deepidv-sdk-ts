// ----------------------------------------------------------------------
// Coupled steps — pairs that auto-add together
// ----------------------------------------------------------------------

export const COUPLED_STEPS: Record<string, string[]> = {
  'bank-statement-upload': ['ai-bank-statement-analysis'],
  'ai-bank-statement-analysis': ['bank-statement-upload'],
  'background-check': ['id-verification'],
  'criminal-background-check': ['id-verification'],
  'credit-check': ['id-verification'],
};

// ----------------------------------------------------------------------
// Step icon gradients
// ----------------------------------------------------------------------

export const STEP_ICON_GRADIENTS: Record<string, string> = {
  'id-verification': 'linear-gradient(135deg, #007AFF, #5AC8FA)',
  'face-liveness': 'linear-gradient(135deg, #AF52DE, #DA8FFF)',
  'deepfake-detection': 'linear-gradient(135deg, #FF2D55, #FF6961)',
  'age-estimation': 'linear-gradient(135deg, #FF9500, #FFBD44)',
  'pep-sanctions': 'linear-gradient(135deg, #34C759, #63E888)',
  'adverse-media': 'linear-gradient(135deg, #FF3B30, #FF6B6B)',
  'bank-statement-upload': 'linear-gradient(135deg, #FF9500, #FFBD44)',
  'ai-bank-statement-analysis': 'linear-gradient(135deg, #FF9500, #FFBD44)',
  'nfc-verification': 'linear-gradient(135deg, #5856D6, #8B89E0)',
  'passport-nfc-scanner': 'linear-gradient(135deg, #5856D6, #8B89E0)',
  'custom-prompt': 'linear-gradient(135deg, #FF2D55, #FF6B81)',
  'custom-form': 'linear-gradient(135deg, #FF2D55, #FF6B81)',
  'document-upload': 'linear-gradient(135deg, #00C7BE, #63E6D4)',
  'title-search': 'linear-gradient(135deg, #5856D6, #8B89E0)',
  'e-signature': 'linear-gradient(135deg, #30B0C7, #64D2FF)',
  consent: 'linear-gradient(135deg, #34C759, #63E888)',
  'credit-check': 'linear-gradient(135deg, #FF9F0A, #FFBD44)',
  'criminal-background-check': 'linear-gradient(135deg, #5856D6, #8B89E0)',
  'vulnerable-sector-check': 'linear-gradient(135deg, #AF52DE, #DA8FFF)',
  'financial-crime-check': 'linear-gradient(135deg, #FF3B30, #FF6B6B)',
  'phone-verification': 'linear-gradient(135deg, #7C3AED, #A78BFA)',
  proofcall: 'linear-gradient(135deg, #6D4C2A, #A0744F)',
  'drivers-abstract': 'linear-gradient(135deg, #1B5E20, #388E3C)',
  'education-confirmation': 'linear-gradient(135deg, #E91E63, #F48FB1)',
  kyb: 'linear-gradient(135deg, #8B6914, #C49B2A)',
  'white-label': 'linear-gradient(135deg, #5856D6, #AF52DE)',
  'address-verification': 'linear-gradient(135deg, #0781DF, #36A3F7)',
};
