import { FormProcessor } from "@/components/FormProcessor";

interface IndexProps {
  hfToken: string;
}

const Index = ({ hfToken }: IndexProps) => {
  return <FormProcessor hfToken={hfToken} />;
};

export default Index;
