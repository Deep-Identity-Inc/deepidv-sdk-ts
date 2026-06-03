import type { StepDefinition, WorkflowTemplate } from '../types.js';

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

// ----------------------------------------------------------------------
// Default step definitions
// ----------------------------------------------------------------------

export const DEFAULT_STEPS: StepDefinition[] = [
  {
    id: 'id-verification',
    label: 'ID Verification',
    description: 'Verify government-issued identity documents',
    icon: 'solar:user-id-bold-duotone',
    category: 'Verify',
    propertyGroups: [
      {
        groupId: 'fraud-analysis-settings',
        groupName: 'Fraud Analysis',
        groupTooltip: 'Activate fraud prevention to ensure identification is authentic.',
        properties: [
          {
            id: 'enable-fraud-analysis',
            label: 'Enable Fraud Analysis',
            sublabel: 'Activate fraud prevention to ensure identification is authentic.',
            type: 'boolean',
            value: false,
          },
        ],
      },
      {
        groupId: 'fraud-analysis-escalation',
        groupName: 'Escalation',
        groupTooltip: 'Trigger an extra verification when Fraud Analysis returns high-risk.',
        parentToggle: 'enable-fraud-analysis',
        properties: [
          {
            id: 'escalation-type',
            label: 'Escalation type',
            type: 'select',
            value: 'none',
            options: [
              { value: 'none', label: 'None' },
              { value: 'nfc-passport', label: 'Passport NFC Scan' },
            ],
          },
          {
            id: 'escalation-risk-threshold',
            label: 'Trigger when risk is at or above',
            type: 'slider',
            value: 60,
            min: 0,
            max: 100,
            step: 5,
            unit: '%',
            marks: [
              { value: 0, label: '0%' },
              { value: 25, label: '25%' },
              { value: 50, label: '50%' },
              { value: 60, label: '60%' },
              { value: 75, label: '75%' },
              { value: 100, label: '100%' },
            ],
            requirement: { id: 'escalation-type', notEquals: 'none' },
          },
        ],
      },
      {
        groupId: 'id-scan-settings',
        groupName: 'Additional Required Documents',
        groupTooltip: 'Enable the requesting of additional documents.',
        properties: [
          {
            id: 'require-secondary-id',
            label: 'Require Secondary ID',
            type: 'boolean',
            value: false,
          },
          {
            id: 'require-tertiary-id',
            label: 'Require Tertiary ID',
            type: 'boolean',
            value: false,
            requirement: 'require-secondary-id',
          },
        ],
      },
      {
        groupId: 'id-scan-face-settings',
        groupName: 'Required ID Faces',
        groupTooltip: 'Select which faces of the ID document(s) are required for verification.',
        properties: [
          { id: 'require-front-only', label: 'Require Front Only', type: 'boolean', value: false },
        ],
      },
      {
        groupId: 'face-scan-settings',
        groupName: 'Face Photos',
        groupTooltip: 'Specify which face photos are required.',
        properties: [
          { id: 'face-front-photo-only', label: 'Front Photo Only', type: 'boolean', value: true },
        ],
      },
      {
        groupId: 'age-restriction-settings',
        groupName: 'Age Restriction',
        groupTooltip: 'Set age requirements for this verification step.',
        properties: [
          {
            id: 'minimum-age',
            label: 'Minimum Age',
            type: 'range',
            value: [18, 100],
            min: 0,
            max: 100,
            lowerLabel: 'Too young',
            upperLabel: 'Too old',
          },
        ],
      },
      {
        groupId: 'expiry-date-settings',
        groupName: 'Minimum ID Validity',
        groupTooltip: 'Set the minimum number of days an ID must remain valid after submission.',
        properties: [
          {
            id: 'expiry-date',
            label: 'Expiry Date',
            type: 'slider',
            value: 2,
            marks: [
              { value: 0, label: 'None' },
              { value: 1, label: '30 days' },
              { value: 2, label: '60 days' },
              { value: 3, label: '180 days' },
              { value: 4, label: '1 year' },
            ],
            min: 0,
            max: 4,
            step: 1,
          },
        ],
      },
    ],
  },
  {
    id: 'face-liveness',
    label: 'Face Liveness',
    description: 'Real-time liveness detection to prevent spoofing',
    icon: 'solar:face-scan-circle-bold-duotone',
    category: 'Verify',
    propertyGroups: [
      {
        groupId: 'face-liveness-settings',
        groupName: 'Face Liveness Settings',
        groupTooltip: 'Settings for face liveness.',
        properties: [
          {
            id: 'preferred-liveness-method',
            label: 'Preferred Liveness Method',
            type: 'select',
            options: [
              { value: 'FaceMovementChallenge', label: 'Face Movement' },
              { value: 'FaceMovementAndLightChallenge', label: 'Flashing Lights' },
            ],
            value: 'FaceMovementChallenge',
          },
        ],
      },
      {
        groupId: 'face-liveness-confidence-settings',
        groupName: 'Face Liveness Confidence',
        groupTooltip: 'Settings for face liveness confidence.',
        properties: [
          {
            id: 'confidence-threshold',
            label: 'Confidence Threshold',
            type: 'slider',
            value: 70,
            min: 0,
            max: 100,
            step: 1,
          },
        ],
      },
    ],
  },
  {
    id: 'deepfake-detection',
    label: 'Deepfake Detection',
    description: 'Real-time detection to prevent swapping',
    icon: 'solar:shield-network-bold-duotone',
    category: 'Verify',
    propertyGroups: [
      {
        groupId: 'deepfake-detection-settings',
        groupName: 'Deepfake Detection Settings',
        groupTooltip: 'Settings for verification.',
        properties: [
          {
            id: 'mesh-visuals',
            label: 'Mesh Visuals',
            type: 'select',
            options: [
              { value: '3d-ar-mesh', label: '3D AR Mesh' },
              { value: 'no-mesh', label: 'No Mesh Visuals' },
            ],
            value: '3d-ar-mesh',
          },
          {
            id: 'use-custom-word',
            label: 'Use Custom Challenge Word',
            type: 'boolean',
            value: false,
          },
          {
            id: 'challenge-word',
            label: 'Challenge Word',
            type: 'text',
            value: '',
            requirement: 'use-custom-word',
          },
        ],
      },
      {
        groupId: 'deepfake-confidence-settings',
        groupName: 'Deepfake Confidence',
        groupTooltip: 'Settings for deepfake detection confidence.',
        properties: [
          {
            id: 'confidence-threshold',
            label: 'Confidence Threshold',
            type: 'slider',
            value: 70,
            min: 0,
            max: 100,
            step: 1,
          },
        ],
      },
    ],
  },
  {
    id: 'age-estimation',
    label: 'Age Estimation',
    description: 'AI-based age verification without document upload',
    icon: 'solar:user-bold-duotone',
    category: 'Screen',
    propertyGroups: [
      {
        groupId: 'age-restriction-settings',
        groupName: 'Age Restriction',
        groupTooltip: 'Set age requirements for this verification step.',
        properties: [
          {
            id: 'minimum-age',
            label: 'Minimum Age',
            type: 'range',
            value: [18, 100],
            min: 0,
            max: 100,
            lowerLabel: 'Too young',
            upperLabel: 'Too old',
          },
        ],
      },
    ],
  },
  {
    id: 'pep-sanctions',
    label: 'PEP/Sanctions',
    description: 'Check against global PEP and sanctions lists',
    icon: 'solar:shield-check-bold-duotone',
    category: 'Screen',
  },
  {
    id: 'adverse-media',
    label: 'Adverse Media',
    description: 'Search for negative news and media mentions',
    icon: 'solar:document-text-bold-duotone',
    category: 'Screen',
  },
  {
    id: 'address-verification',
    label: 'Address Verification',
    description: 'Verify applicant address through location-based quiz',
    icon: 'solar:map-point-bold-duotone',
    category: 'Verify',
    propertyGroups: [
      {
        groupId: 'address-verification-settings',
        groupName: 'Address Verification Settings',
        groupTooltip: 'Configure the address verification quiz options.',
        properties: [
          {
            id: 'num-questions',
            label: 'Number of Questions',
            type: 'select',
            value: '3',
            options: [
              { value: '3', label: '3' },
              { value: '4', label: '4' },
              { value: '5', label: '5' },
              { value: '6', label: '6' },
              { value: '7', label: '7' },
              { value: '8', label: '8' },
              { value: '9', label: '9' },
              { value: '10', label: '10' },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'phone-verification',
    label: 'Phone Verification',
    description: 'Verify identity through a spoken prompt over phone',
    icon: 'solar:phone-bold-duotone',
    category: 'Verify',
    propertyGroups: [
      {
        groupId: 'phone-verification-settings',
        groupName: 'Phone Verification Settings',
        groupTooltip: 'Configure the verification prompt.',
        properties: [
          {
            id: 'verification-prompt',
            label: 'Verification Prompt',
            type: 'text',
            required: true,
            maxLength: 60,
            value: '',
          },
        ],
      },
    ],
  },
  {
    id: 'bank-statement-upload',
    label: 'Bank Statement',
    description: 'Retrieve and analyze bank statements',
    icon: 'solar:document-text-bold-duotone',
    category: 'Docs',
    propertyGroups: [
      {
        groupId: 'bank-statement-settings',
        groupName: 'Statement Upload Settings',
        groupTooltip: 'Settings for bank statement upload step.',
        properties: [
          {
            id: 'account-type',
            label: 'Account Type',
            type: 'select',
            options: [
              { value: 'checking', label: 'Checking' },
              { value: 'savings', label: 'Savings' },
            ],
            value: 'checking',
          },
        ],
      },
    ],
  },
  {
    id: 'ai-bank-statement-analysis',
    label: 'AI Bank Analysis',
    description: 'AI-powered income and spending analysis',
    icon: 'solar:chart-2-bold-duotone',
    category: 'Docs',
    coupled: true,
  },
  {
    id: 'document-upload',
    label: 'Document Upload',
    description: 'Collect and verify uploaded documents',
    icon: 'solar:upload-minimalistic-bold-duotone',
    category: 'Docs',
    propertyGroups: [
      {
        groupId: 'document-upload-settings',
        groupName: 'Document Upload Settings',
        groupTooltip: 'Configure the documents to collect.',
        properties: [
          {
            id: 'document-upload-list',
            label: 'Documents',
            type: 'doc-upload',
            value: [{ text: 'Document 1' }],
          },
        ],
      },
    ],
  },
  {
    id: 'custom-form',
    label: 'Custom Form',
    description: 'Collect custom data with flexible form fields',
    icon: 'solar:document-add-bold-duotone',
    category: 'Docs',
    propertyGroups: [
      {
        groupId: 'custom-form-fields',
        groupName: 'Form Fields',
        groupTooltip: 'Define the form fields for data collection.',
        properties: [{ id: 'form-fields', label: 'Fields', type: 'form-fields', value: [] }],
      },
    ],
  },
  {
    id: 'custom-prompt',
    label: 'Custom Photo',
    description: 'Request a specific photo from the applicant',
    icon: 'solar:camera-bold-duotone',
    category: 'Docs',
    propertyGroups: [
      {
        groupId: 'custom-prompt-settings',
        groupName: 'Photo Prompts',
        groupTooltip: 'Configure the photo prompts.',
        properties: [
          {
            id: 'custom-prompts-list',
            label: 'Prompts',
            type: 'text-list',
            value: [{ text: 'Take a photo' }],
          },
        ],
      },
    ],
  },
  {
    id: 'title-search',
    label: 'Title Search',
    description: 'Property ownership and lien records lookup',
    icon: 'solar:home-bold-duotone',
    category: 'Screen',
  },
  {
    id: 'consent',
    label: 'Consent',
    description: 'Capture applicant consent before verification',
    icon: 'solar:check-circle-bold-duotone',
    category: 'Verify',
  },
  {
    id: 'kyb',
    label: 'KYB',
    description: 'Know Your Business verification',
    icon: 'solar:buildings-bold-duotone',
    category: 'Screen',
  },
];

// ----------------------------------------------------------------------
// Default workflow templates
// ----------------------------------------------------------------------

export const DEFAULT_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'kyc-onboarding',
    label: 'KYC Onboarding',
    description: 'Standard identity verification for customer onboarding',
    steps: ['id-verification', 'face-liveness', 'pep-sanctions', 'adverse-media'],
  },
  {
    id: 'lending',
    label: 'Lending & Financial Services',
    description: 'Comprehensive verification for lending workflows',
    steps: [
      'id-verification',
      'face-liveness',
      'bank-statement-upload',
      'pep-sanctions',
      'document-upload',
    ],
  },
  {
    id: 'age-gated',
    label: 'Age-Gated Access',
    description: 'Lightweight age verification with ID fallback',
    steps: ['age-estimation', 'face-liveness'],
  },
  {
    id: 'property',
    label: 'Property & Real Estate',
    description: 'Verification for property transactions',
    steps: ['id-verification', 'title-search', 'document-upload', 'custom-form'],
  },
];
