import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Save, Upload } from "lucide-react";
import { toast } from "sonner";

export interface PersonalInfo {
  firstName: string;
  middleName: string;
  lastName: string;
  gender: string;
  maritalStatus: string;
  cellPhone: string;
  workPhone: string;
  homeAddress: string;
  state: string;
  zipCode: string;
}

interface PersonalInfoFormProps {
  formData: PersonalInfo;
  setFormData: (data: PersonalInfo) => void;
  pin: string;
  setPin: (pin: string) => void;
  onSave: () => void;
  onLoad: () => void;
}

const STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
];

export const PersonalInfoForm = ({ 
  formData, 
  setFormData, 
  pin, 
  setPin, 
  onSave, 
  onLoad 
}: PersonalInfoFormProps) => {
  const handleInputChange = (field: keyof PersonalInfo, value: string) => {
    setFormData({ ...formData, [field]: value });
  };

  return (
    <Card className="shadow-elegant">
      <CardHeader className="bg-gradient-primary text-white">
        <CardTitle className="text-2xl font-semibold">Personal Information</CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        {/* Name Fields */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="firstName">First Name</Label>
            <Input
              id="firstName"
              value={formData.firstName}
              onChange={(e) => handleInputChange("firstName", e.target.value)}
              placeholder="Enter first name"
              className="border-2 focus:border-primary transition-smooth"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="middleName">Middle Name</Label>
            <Input
              id="middleName"
              value={formData.middleName}
              onChange={(e) => handleInputChange("middleName", e.target.value)}
              placeholder="Enter middle name"
              className="border-2 focus:border-primary transition-smooth"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Last Name</Label>
            <Input
              id="lastName"
              value={formData.lastName}
              onChange={(e) => handleInputChange("lastName", e.target.value)}
              placeholder="Enter last name"
              className="border-2 focus:border-primary transition-smooth"
            />
          </div>
        </div>

        {/* Personal Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="gender">Gender</Label>
            <Select value={formData.gender} onValueChange={(value) => handleInputChange("gender", value)}>
              <SelectTrigger className="border-2 focus:border-primary">
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="other">Other</SelectItem>
                <SelectItem value="prefer-not-to-say">Prefer not to say</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="maritalStatus">Marital Status</Label>
            <Select value={formData.maritalStatus} onValueChange={(value) => handleInputChange("maritalStatus", value)}>
              <SelectTrigger className="border-2 focus:border-primary">
                <SelectValue placeholder="Select marital status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single">Single</SelectItem>
                <SelectItem value="married">Married</SelectItem>
                <SelectItem value="divorced">Divorced</SelectItem>
                <SelectItem value="widowed">Widowed</SelectItem>
                <SelectItem value="separated">Separated</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Phone Numbers */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="cellPhone">Cell Phone</Label>
            <Input
              id="cellPhone"
              value={formData.cellPhone}
              onChange={(e) => handleInputChange("cellPhone", e.target.value)}
              placeholder="(555) 123-4567"
              className="border-2 focus:border-primary transition-smooth"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="workPhone">Work Phone</Label>
            <Input
              id="workPhone"
              value={formData.workPhone}
              onChange={(e) => handleInputChange("workPhone", e.target.value)}
              placeholder="(555) 123-4567"
              className="border-2 focus:border-primary transition-smooth"
            />
          </div>
        </div>

        {/* Address */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="homeAddress">Home Address</Label>
            <Input
              id="homeAddress"
              value={formData.homeAddress}
              onChange={(e) => handleInputChange("homeAddress", e.target.value)}
              placeholder="123 Main Street, City"
              className="border-2 focus:border-primary transition-smooth"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Select value={formData.state} onValueChange={(value) => handleInputChange("state", value)}>
                <SelectTrigger className="border-2 focus:border-primary">
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent>
                  {STATES.map((state) => (
                    <SelectItem key={state} value={state}>
                      {state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="zipCode">ZIP Code</Label>
              <Input
                id="zipCode"
                value={formData.zipCode}
                onChange={(e) => handleInputChange("zipCode", e.target.value)}
                placeholder="12345"
                className="border-2 focus:border-primary transition-smooth"
              />
            </div>
          </div>
        </div>

        {/* PIN Management */}
        <div className="space-y-4 border-t pt-6">
          <div className="space-y-2">
            <Label htmlFor="pin">PIN (4-6 digits)</Label>
            <Input
              id="pin"
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Enter PIN"
              maxLength={6}
              className="border-2 focus:border-primary transition-smooth"
            />
          </div>
          <div className="flex gap-3">
            <Button 
              onClick={onSave} 
              className="flex-1 bg-gradient-primary hover:opacity-90 transition-smooth"
              disabled={!pin || pin.length < 4}
            >
              <Save className="w-4 h-4 mr-2" />
              Save Profile
            </Button>
            <Button 
              onClick={onLoad} 
              variant="outline"
              className="flex-1 border-2 border-primary text-primary hover:bg-primary hover:text-white transition-smooth"
              disabled={!pin || pin.length < 4}
            >
              <Upload className="w-4 h-4 mr-2" />
              Load Profile
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};