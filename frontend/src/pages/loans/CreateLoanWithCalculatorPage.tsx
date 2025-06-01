import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Box,
  Alert,
  Stepper,
  Step,
  StepLabel,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  InputAdornment,
  Divider,
  Chip,
  FormControlLabel,
  Switch,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LoanEngine } from '@lendpeak/engine';
import { format, addMonths } from 'date-fns';

interface BorrowerData {
  id?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  ssn: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
  };
}

interface LoanData {
  borrowerId?: string;
  principal: number;
  interestRate: number;
  termMonths: number;
  loanType: 'fixed' | 'variable' | 'interest-only' | 'balloon';
  balloonMonths?: number;
  startDate: Date;
  origination: {
    fee: number;
    points: number;
    otherFees: number;
  };
}

const steps = ['Borrower Information', 'Loan Details & Calculator', 'Review & Submit'];

const CreateLoanWithCalculatorPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [borrowerSearchTerm, setBorrowerSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<BorrowerData[]>([]);
  const [createNewBorrower, setCreateNewBorrower] = useState(false);
  const [showAmortization, setShowAmortization] = useState(false);
  
  // Form state
  const [borrower, setBorrower] = useState<BorrowerData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    ssn: '',
    address: {
      street: '',
      city: '',
      state: '',
      zipCode: '',
    },
  });

  const [loan, setLoan] = useState<LoanData>({
    principal: 200000,
    interestRate: 4.5,
    termMonths: 360,
    loanType: 'fixed',
    startDate: new Date(),
    origination: {
      fee: 0,
      points: 0,
      otherFees: 0,
    },
  });

  // Calculated values
  const [monthlyPayment, setMonthlyPayment] = useState(0);
  const [totalInterest, setTotalInterest] = useState(0);
  const [totalPayment, setTotalPayment] = useState(0);
  const [amortizationSchedule, setAmortizationSchedule] = useState<any[]>([]);

  // Search for borrowers
  const searchBorrowers = async () => {
    if (borrowerSearchTerm.length < 2) return;
    
    try {
      const response = await fetch(
        `/api/borrowers/search?q=${encodeURIComponent(borrowerSearchTerm)}`
      );
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data);
      }
    } catch (err) {
      console.error('Error searching borrowers:', err);
    }
  };

  // Calculate loan whenever parameters change
  useEffect(() => {
    calculateLoan();
  }, [loan.principal, loan.interestRate, loan.termMonths, loan.loanType, loan.balloonMonths]);

  const calculateLoan = () => {
    try {
      const loanTerms = LoanEngine.createLoan(
        loan.principal,
        loan.interestRate,
        loan.termMonths,
        loan.startDate || new Date(),
        {
          paymentFrequency: 'monthly',
          interestType: loan.loanType === 'balloon' ? 'balloon' : 'amortized',
        }
      );
      
      const paymentResult = LoanEngine.calculatePayment(loanTerms);
      const schedule = LoanEngine.generateSchedule(loanTerms);
      
      const totalInterest = schedule.payments.reduce((sum, payment) => {
        return sum + (payment.interest?.toNumber() || 0);
      }, 0);
      
      setMonthlyPayment(paymentResult.monthlyPayment.toNumber());
      setTotalInterest(totalInterest);
      setTotalPayment(paymentResult.monthlyPayment.toNumber() * loan.termMonths);
      
      if (showAmortization) {
        setAmortizationSchedule(schedule.payments.map((payment, index) => ({
          paymentNumber: index + 1,
          dueDate: payment.dueDate.toDate(),
          principal: payment.principal?.toNumber() || 0,
          interest: payment.interest?.toNumber() || 0,
          totalPayment: payment.totalPayment?.toNumber() || 0,
          remainingBalance: payment.remainingBalance?.toNumber() || 0,
        })));
      }
    } catch (error) {
      console.error('Loan calculation error:', error);
    }
  };

  const handleNext = () => {
    if (activeStep === 0 && (!borrower.id && !createNewBorrower)) {
      setError('Please select or create a borrower');
      return;
    }
    
    if (activeStep === steps.length - 1) {
      handleSubmit();
    } else {
      setActiveStep((prevActiveStep) => prevActiveStep + 1);
    }
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Create borrower if new
      let borrowerId = borrower.id;
      if (!borrowerId && createNewBorrower) {
        const borrowerResponse = await fetch('/api/borrowers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(borrower),
        });
        
        if (!borrowerResponse.ok) {
          throw new Error('Failed to create borrower');
        }
        
        const newBorrower = await borrowerResponse.json();
        borrowerId = newBorrower.id;
      }
      
      // Create loan
      const loanData = {
        ...loan,
        borrowerId,
        monthlyPayment,
        totalInterest,
        totalPayment,
      };
      
      const loanResponse = await fetch('/api/loans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loanData),
      });
      
      if (!loanResponse.ok) {
        throw new Error('Failed to create loan');
      }
      
      const newLoan = await loanResponse.json();
      setSuccess('Loan created successfully!');
      
      // Redirect to loan details after 2 seconds
      setTimeout(() => {
        navigate(`/loans/${newLoan.id}`);
      }, 2000);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const renderBorrowerStep = () => (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Typography variant="h6" gutterBottom>
          Search Existing Borrower
        </Typography>
        <TextField
          fullWidth
          label="Search by name, email, or phone"
          value={borrowerSearchTerm}
          onChange={(e) => setBorrowerSearchTerm(e.target.value)}
          onKeyUp={(e) => {
            if (e.key === 'Enter') searchBorrowers();
          }}
          InputProps={{
            endAdornment: (
              <Button onClick={searchBorrowers} size="small">
                Search
              </Button>
            ),
          }}
        />
      </Grid>
      
      {searchResults.length > 0 && (
        <Grid item xs={12}>
          <Paper elevation={1}>
            <Box p={2}>
              <Typography variant="subtitle2" gutterBottom>
                Search Results
              </Typography>
              {searchResults.map((result) => (
                <Box
                  key={result.id}
                  p={1}
                  sx={{
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'action.hover' },
                    borderRadius: 1,
                  }}
                  onClick={() => {
                    setBorrower(result);
                    setCreateNewBorrower(false);
                  }}
                >
                  <Typography>
                    {result.firstName} {result.lastName} - {result.email}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Paper>
        </Grid>
      )}
      
      <Grid item xs={12}>
        <Divider>OR</Divider>
      </Grid>
      
      <Grid item xs={12}>
        <FormControlLabel
          control={
            <Switch
              checked={createNewBorrower}
              onChange={(e) => setCreateNewBorrower(e.target.checked)}
            />
          }
          label="Create New Borrower"
        />
      </Grid>
      
      {createNewBorrower && (
        <>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="First Name"
              value={borrower.firstName}
              onChange={(e) => setBorrower({ ...borrower, firstName: e.target.value })}
              required
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Last Name"
              value={borrower.lastName}
              onChange={(e) => setBorrower({ ...borrower, lastName: e.target.value })}
              required
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={borrower.email}
              onChange={(e) => setBorrower({ ...borrower, email: e.target.value })}
              required
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Phone"
              value={borrower.phone}
              onChange={(e) => setBorrower({ ...borrower, phone: e.target.value })}
              required
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="SSN"
              value={borrower.ssn}
              onChange={(e) => setBorrower({ ...borrower, ssn: e.target.value })}
              required
            />
          </Grid>
          <Grid item xs={12}>
            <Typography variant="subtitle1" gutterBottom>
              Address
            </Typography>
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Street Address"
              value={borrower.address.street}
              onChange={(e) =>
                setBorrower({
                  ...borrower,
                  address: { ...borrower.address, street: e.target.value },
                })
              }
              required
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="City"
              value={borrower.address.city}
              onChange={(e) =>
                setBorrower({
                  ...borrower,
                  address: { ...borrower.address, city: e.target.value },
                })
              }
              required
            />
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField
              fullWidth
              label="State"
              value={borrower.address.state}
              onChange={(e) =>
                setBorrower({
                  ...borrower,
                  address: { ...borrower.address, state: e.target.value },
                })
              }
              required
            />
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField
              fullWidth
              label="ZIP Code"
              value={borrower.address.zipCode}
              onChange={(e) =>
                setBorrower({
                  ...borrower,
                  address: { ...borrower.address, zipCode: e.target.value },
                })
              }
              required
            />
          </Grid>
        </>
      )}
      
      {borrower.id && !createNewBorrower && (
        <Grid item xs={12}>
          <Alert severity="success">
            Selected Borrower: {borrower.firstName} {borrower.lastName} ({borrower.email})
          </Alert>
        </Grid>
      )}
    </Grid>
  );

  const renderLoanStep = () => (
    <Grid container spacing={3}>
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Loan Parameters
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Loan Amount"
                  type="number"
                  value={loan.principal}
                  onChange={(e) => setLoan({ ...loan, principal: Number(e.target.value) })}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Interest Rate"
                  type="number"
                  value={loan.interestRate}
                  onChange={(e) => setLoan({ ...loan, interestRate: Number(e.target.value) })}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">%</InputAdornment>,
                  }}
                  inputProps={{ step: 0.125 }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Term"
                  type="number"
                  value={loan.termMonths}
                  onChange={(e) => setLoan({ ...loan, termMonths: Number(e.target.value) })}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">months</InputAdornment>,
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Loan Type</InputLabel>
                  <Select
                    value={loan.loanType}
                    onChange={(e) => setLoan({ ...loan, loanType: e.target.value as any })}
                    label="Loan Type"
                  >
                    <MenuItem value="fixed">Fixed Rate</MenuItem>
                    <MenuItem value="variable">Variable Rate</MenuItem>
                    <MenuItem value="interest-only">Interest Only</MenuItem>
                    <MenuItem value="balloon">Balloon</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              {loan.loanType === 'balloon' && (
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Balloon Period"
                    type="number"
                    value={loan.balloonMonths || ''}
                    onChange={(e) => setLoan({ ...loan, balloonMonths: Number(e.target.value) })}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">months</InputAdornment>,
                    }}
                    helperText="Number of months before balloon payment is due"
                  />
                </Grid>
              )}
              <Grid item xs={12}>
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <DatePicker
                    label="Start Date"
                    value={loan.startDate}
                    onChange={(date) => date && setLoan({ ...loan, startDate: date })}
                    renderInput={(params) => <TextField {...params} fullWidth />}
                  />
                </LocalizationProvider>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  Origination Fees
                </Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="Origination Fee"
                  type="number"
                  value={loan.origination.fee}
                  onChange={(e) =>
                    setLoan({
                      ...loan,
                      origination: { ...loan.origination, fee: Number(e.target.value) },
                    })
                  }
                  InputProps={{
                    startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="Points"
                  type="number"
                  value={loan.origination.points}
                  onChange={(e) =>
                    setLoan({
                      ...loan,
                      origination: { ...loan.origination, points: Number(e.target.value) },
                    })
                  }
                  inputProps={{ step: 0.125 }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="Other Fees"
                  type="number"
                  value={loan.origination.otherFees}
                  onChange={(e) =>
                    setLoan({
                      ...loan,
                      origination: { ...loan.origination, otherFees: Number(e.target.value) },
                    })
                  }
                  InputProps={{
                    startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  }}
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Grid>
      
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Loan Summary
            </Typography>
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography>Monthly Payment:</Typography>
                <Typography variant="h5" color="primary">
                  ${monthlyPayment.toFixed(2)}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography>Total Interest:</Typography>
                <Typography variant="h6">${totalInterest.toFixed(2)}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography>Total Payment:</Typography>
                <Typography variant="h6">${totalPayment.toFixed(2)}</Typography>
              </Box>
              {loan.loanType === 'balloon' && loan.balloonMonths && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography>Balloon Payment:</Typography>
                  <Typography variant="h6" color="warning.main">
                    ${(loan.principal - (monthlyPayment * loan.balloonMonths - totalInterest)).toFixed(2)}
                  </Typography>
                </Box>
              )}
            </Box>
            
            <Divider sx={{ my: 2 }} />
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="subtitle1">Amortization Schedule</Typography>
              <Switch
                checked={showAmortization}
                onChange={(e) => {
                  setShowAmortization(e.target.checked);
                  if (e.target.checked) calculateLoan();
                }}
              />
            </Box>
          </CardContent>
        </Card>
      </Grid>
      
      {showAmortization && amortizationSchedule.length > 0 && (
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Amortization Schedule
              </Typography>
              <TableContainer sx={{ maxHeight: 400 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Payment #</TableCell>
                      <TableCell>Date</TableCell>
                      <TableCell align="right">Payment</TableCell>
                      <TableCell align="right">Principal</TableCell>
                      <TableCell align="right">Interest</TableCell>
                      <TableCell align="right">Balance</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {amortizationSchedule.slice(0, 360).map((payment) => (
                      <TableRow key={payment.paymentNumber}>
                        <TableCell>{payment.paymentNumber}</TableCell>
                        <TableCell>
                          {format(
                            addMonths(loan.startDate, payment.paymentNumber - 1),
                            'MMM dd, yyyy'
                          )}
                        </TableCell>
                        <TableCell align="right">
                          ${payment.payment.toFixed(2)}
                        </TableCell>
                        <TableCell align="right">
                          ${payment.principal.toFixed(2)}
                        </TableCell>
                        <TableCell align="right">
                          ${payment.interest.toFixed(2)}
                        </TableCell>
                        <TableCell align="right">
                          ${payment.balance.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      )}
    </Grid>
  );

  const renderReviewStep = () => (
    <Grid container spacing={3}>
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Borrower Information
            </Typography>
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Name
              </Typography>
              <Typography>
                {borrower.firstName} {borrower.lastName}
              </Typography>
            </Box>
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Email
              </Typography>
              <Typography>{borrower.email}</Typography>
            </Box>
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Phone
              </Typography>
              <Typography>{borrower.phone}</Typography>
            </Box>
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Address
              </Typography>
              <Typography>
                {borrower.address.street}
                <br />
                {borrower.address.city}, {borrower.address.state} {borrower.address.zipCode}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Grid>
      
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Loan Details
            </Typography>
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Loan Amount
              </Typography>
              <Typography>${loan.principal.toLocaleString()}</Typography>
            </Box>
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Interest Rate
              </Typography>
              <Typography>{loan.interestRate}%</Typography>
            </Box>
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Term
              </Typography>
              <Typography>{loan.termMonths} months ({loan.termMonths / 12} years)</Typography>
            </Box>
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Loan Type
              </Typography>
              <Typography>
                {loan.loanType.charAt(0).toUpperCase() + loan.loanType.slice(1).replace('-', ' ')}
                {loan.loanType === 'balloon' && loan.balloonMonths && (
                  <Chip
                    label={`${loan.balloonMonths} month balloon`}
                    size="small"
                    color="warning"
                    sx={{ ml: 1 }}
                  />
                )}
              </Typography>
            </Box>
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Start Date
              </Typography>
              <Typography>{format(loan.startDate, 'MMMM dd, yyyy')}</Typography>
            </Box>
            <Divider sx={{ my: 2 }} />
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Monthly Payment
              </Typography>
              <Typography variant="h5" color="primary">
                ${monthlyPayment.toFixed(2)}
              </Typography>
            </Box>
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Total Interest
              </Typography>
              <Typography>${totalInterest.toFixed(2)}</Typography>
            </Box>
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Total Payment
              </Typography>
              <Typography>${totalPayment.toFixed(2)}</Typography>
            </Box>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  const getStepContent = (step: number) => {
    switch (step) {
      case 0:
        return renderBorrowerStep();
      case 1:
        return renderLoanStep();
      case 2:
        return renderReviewStep();
      default:
        return <div>Unknown step</div>;
    }
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Create New Loan
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Create a new loan with integrated calculator
        </Typography>
      </Box>
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      
      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {success}
        </Alert>
      )}
      
      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>
      
      <Box>{getStepContent(activeStep)}</Box>
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
        <Button
          disabled={activeStep === 0}
          onClick={handleBack}
          sx={{ mr: 1 }}
        >
          Back
        </Button>
        <Button
          variant="contained"
          onClick={handleNext}
          disabled={loading}
        >
          {activeStep === steps.length - 1 ? 'Create Loan' : 'Next'}
        </Button>
      </Box>
    </Container>
  );
};

export default CreateLoanWithCalculatorPage;