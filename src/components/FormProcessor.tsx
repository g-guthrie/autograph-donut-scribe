import { useState } from "react";
import { PersonalInfoForm, PersonalInfo } from "./PersonalInfoForm";
import { SignatureCanvas } from "./SignatureCanvas";
import { PDFProcessor } from "./PDFProcessor";
import { toast } from "sonner";

interface FormProcessorProps {
  hfToken: string;
}

const INITIAL_FORM_DATA: PersonalInfo = {
  firstName: "",
  middleName: "",
  lastName: "",
  gender: "",
  maritalStatus: "",
  cellPhone: "",
  workPhone: "",
  homeAddress: "",
  state: "",
  zipCode: "",
};

interface SavedProfile {
  formData: PersonalInfo;
  signatureDataUrl: string | null;
  timestamp: number;
}

export const FormProcessor = ({ hfToken }: FormProcessorProps) => {
  const [formData, setFormData] = useState<PersonalInfo>(INITIAL_FORM_DATA);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [pin, setPin] = useState("");

  // Load profiles from localStorage
  const loadProfile = () => {
    if (!pin || pin.length < 4) {
      toast.error("Please enter a valid PIN (4-6 digits)");
      return;
    }

    try {
      const saved = localStorage.getItem(`profile_${pin}`);
      if (saved) {
        const profile: SavedProfile = JSON.parse(saved);
        setFormData(profile.formData);
        setSignatureDataUrl(profile.signatureDataUrl);
        toast.success("Profile loaded successfully!");
      } else {
        toast.error("No profile found for this PIN");
      }
    } catch (error) {
      console.error("Error loading profile:", error);
      toast.error("Error loading profile");
    }
  };

  // Save profile to localStorage
  const saveProfile = () => {
    if (!pin || pin.length < 4) {
      toast.error("Please enter a valid PIN (4-6 digits)");
      return;
    }

    try {
      const profile: SavedProfile = {
        formData,
        signatureDataUrl,
        timestamp: Date.now(),
      };
      
      localStorage.setItem(`profile_${pin}`, JSON.stringify(profile));
      toast.success("Profile saved successfully!");
    } catch (error) {
      console.error("Error saving profile:", error);
      toast.error("Error saving profile");
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Smart Form Processor
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Fill out your information, create a digital signature, and automatically 
            process PDF forms with AI-powered field detection and completion.
          </p>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-7xl mx-auto">
          {/* Left Column */}
          <div className="space-y-8">
            <PersonalInfoForm
              formData={formData}
              setFormData={setFormData}
              pin={pin}
              setPin={setPin}
              onSave={saveProfile}
              onLoad={loadProfile}
            />
            
            <SignatureCanvas
              onSignatureChange={setSignatureDataUrl}
              signatureDataUrl={signatureDataUrl}
            />
          </div>

          {/* Right Column */}
          <div>
            <PDFProcessor
              formData={formData}
              signatureDataUrl={signatureDataUrl}
              hfToken={hfToken}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-16 py-8 border-t border-border">
          <p className="text-sm text-muted-foreground">
            Secure local storage • No data transmission • Privacy-focused design
          </p>
        </div>
      </div>
  );
};