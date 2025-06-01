/**
 * Demo Showcase Page
 * Displays all demo loan scenarios in an organized, interactive format
 */

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Box, 
  Container, 
  Typography, 
  Grid, 
  Card, 
  CardContent, 
  CardActions,
  Button,
  Chip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  LinearProgress,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  useTheme,
  alpha,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  AccountBalance as BankIcon,
  DirectionsCar as CarIcon,
  Home as HomeIcon,
  School as SchoolIcon,
  Business as BusinessIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  Schedule as ScheduleIcon,
  Edit as EditIcon,
  Star as StarIcon,
  Visibility as ViewIcon,
  Payment as PaymentIcon,
  History as HistoryIcon,
  Analytics as AnalyticsIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { demoDataService, DEMO_CATEGORIES, type DemoLoan } from '../services/demoDataService';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`demo-tabpanel-${index}`}
      aria-labelledby={`demo-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const categoryIcons: Record<string, React.ReactNode> = {
  STANDARD: <CheckIcon color="success" />,
  DELINQUENT: <WarningIcon color="error" />,
  PREPAYMENT: <TrendingUpIcon color="primary" />,
  MODIFICATION: <EditIcon color="warning" />,
  SPECIAL: <StarIcon color="secondary" />,
};

const categoryColors: Record<string, string> = {
  STANDARD: 'success',
  DELINQUENT: 'error',
  PREPAYMENT: 'primary',
  MODIFICATION: 'warning',
  SPECIAL: 'secondary',
};

const loanTypeIcons: Record<string, React.ReactNode> = {
  'Auto': <CarIcon />,
  'Mortgage': <HomeIcon />,
  'Home': <HomeIcon />,
  'Personal': <BankIcon />,
  'Student': <SchoolIcon />,
  'Business': <BusinessIcon />,
  'Commercial': <BusinessIcon />,
};

function getLoanTypeIcon(loanName: string): React.ReactNode {
  for (const [type, icon] of Object.entries(loanTypeIcons)) {
    if (loanName.toLowerCase().includes(type.toLowerCase())) {
      return icon;
    }
  }
  return <BankIcon />;
}

export default function DemoShowcasePage() {
  const theme = useTheme();
  const navigate = useNavigate();
  
  const [selectedTab, setSelectedTab] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedLoan, setSelectedLoan] = useState<DemoLoan | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  
  // Async data loading states
  const [allLoans, setAllLoans] = useState<DemoLoan[]>([]);
  const [statistics, setStatistics] = useState<any>(null);
  const [loansByCategory, setLoansByCategory] = useState<Record<string, DemoLoan[]>>({});
  const [featuredLoans, setFeaturedLoans] = useState<DemoLoan[]>([]);
  const [loading, setLoading] = useState(true);

  // Load data asynchronously
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [loans, stats, categorized, featured] = await Promise.all([
          demoDataService.getLoans(),
          demoDataService.getStatistics(),
          demoDataService.getLoansByCategory(),
          demoDataService.getFeaturedScenarios(),
        ]);
        
        setAllLoans(loans);
        setStatistics(stats);
        setLoansByCategory(categorized);
        setFeaturedLoans(featured);
      } catch (error) {
        console.error('Error loading demo data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, []);

  const filteredLoans = useMemo(() => {
    let filtered = allLoans;
    
    if (selectedCategory !== 'ALL') {
      filtered = filtered.filter(loan => loan.scenario.category === selectedCategory);
    }
    
    if (selectedStatus !== 'ALL') {
      filtered = filtered.filter(loan => loan.currentState.status === selectedStatus);
    }
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(loan =>
        loan.scenario.name.toLowerCase().includes(term) ||
        loan.scenario.description.toLowerCase().includes(term) ||
        loan.loanNumber.toLowerCase().includes(term)
      );
    }
    
    return filtered;
  }, [allLoans, searchTerm, selectedCategory, selectedStatus]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setSelectedTab(newValue);
  };

  const handleLoanClick = (loan: DemoLoan) => {
    setSelectedLoan(loan);
    setDetailDialogOpen(true);
  };

  const handleViewLoan = (loanId: string) => {
    navigate(`/loans/${loanId}`);
  };

  const handleMakePayment = (loanId: string) => {
    navigate(`/loans/${loanId}/payment`);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercentage = (rate: number) => {
    return `${rate.toFixed(2)}%`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'success';
      case 'DELINQUENT': return 'error';
      case 'PAID_OFF': return 'info';
      case 'PENDING': return 'warning';
      default: return 'default';
    }
  };

  const renderLoanCard = (loan: DemoLoan) => (
    <Card 
      key={loan.id} 
      sx={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        transition: 'all 0.3s ease',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: theme.shadows[8],
        },
      }}
    >
      <CardContent sx={{ flexGrow: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          {getLoanTypeIcon(loan.scenario.name)}
          <Typography variant="h6" component="h3" sx={{ ml: 1, flexGrow: 1 }}>
            {loan.scenario.name}
          </Typography>
          <Chip 
            icon={categoryIcons[loan.scenario.category]}
            label={DEMO_CATEGORIES[loan.scenario.category as keyof typeof DEMO_CATEGORIES]} 
            size="small"
            color={categoryColors[loan.scenario.category] as any}
            variant="outlined"
          />
        </Box>
        
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {loan.scenario.description}
        </Typography>
        
        <Box sx={{ mb: 2 }}>
          <Grid container spacing={1}>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">
                Loan Amount
              </Typography>
              <Typography variant="body2" fontWeight="bold">
                {formatCurrency(loan.scenario.loanParameters.principal)}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">
                Current Balance
              </Typography>
              <Typography variant="body2" fontWeight="bold">
                {formatCurrency(loan.currentState.currentBalance)}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">
                Interest Rate
              </Typography>
              <Typography variant="body2" fontWeight="bold">
                {formatPercentage(loan.scenario.loanParameters.interestRate)}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">
                Monthly Payment
              </Typography>
              <Typography variant="body2" fontWeight="bold">
                {formatCurrency(loan.currentState.monthlyPayment)}
              </Typography>
            </Grid>
          </Grid>
        </Box>
        
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="caption">
              Loan Progress
            </Typography>
            <Typography variant="caption">
              {Math.round(((loan.scenario.loanParameters.termMonths - loan.currentState.remainingTermMonths) / loan.scenario.loanParameters.termMonths) * 100)}%
            </Typography>
          </Box>
          <LinearProgress 
            variant="determinate" 
            value={((loan.scenario.loanParameters.termMonths - loan.currentState.remainingTermMonths) / loan.scenario.loanParameters.termMonths) * 100}
            sx={{ height: 8, borderRadius: 4 }}
          />
        </Box>
        
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip 
            label={loan.currentState.status.replace('_', ' ')} 
            size="small"
            color={getStatusColor(loan.currentState.status) as any}
          />
          
          {loan.currentState.daysPastDue > 0 && (
            <Chip 
              label={`${loan.currentState.daysPastDue} days past due`} 
              size="small"
              color="error"
              variant="outlined"
            />
          )}
          
          {loan.scenario.specialFeatures?.map((feature, index) => (
            <Chip 
              key={index}
              label={feature} 
              size="small"
              variant="outlined"
            />
          ))}
        </Box>
      </CardContent>
      
      <CardActions>
        <Button 
          size="small" 
          startIcon={<ViewIcon />}
          onClick={() => handleLoanClick(loan)}
        >
          Details
        </Button>
        <Button 
          size="small" 
          startIcon={<AnalyticsIcon />}
          onClick={() => handleViewLoan(loan.id)}
        >
          Analyze
        </Button>
        {loan.currentState.status === 'ACTIVE' && (
          <Button 
            size="small" 
            startIcon={<PaymentIcon />}
            onClick={() => handleMakePayment(loan.id)}
            color="primary"
          >
            Pay
          </Button>
        )}
      </CardActions>
    </Card>
  );

  const renderStatsOverview = () => (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        Demo Portfolio Overview
      </Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={3}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h4" color="primary">
              {statistics.totalLoans}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Total Loans
            </Typography>
          </Box>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h4" color="primary">
              {formatCurrency(statistics.portfolioValue)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Portfolio Value
            </Typography>
          </Box>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h4" color="primary">
              {formatCurrency(statistics.averageLoanAmount)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Average Loan
            </Typography>
          </Box>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h4" color={statistics.delinquencyRate > 5 ? 'error' : 'success'}>
              {statistics.delinquencyRate.toFixed(1)}%
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Delinquency Rate
            </Typography>
          </Box>
        </Grid>
      </Grid>
    </Paper>
  );

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Box sx={{ mb: 4, textAlign: 'center' }}>
          <Typography variant="h3" component="h1" gutterBottom>
            LendPeak2 Demo Showcase
          </Typography>
          <LinearProgress sx={{ mt: 4, mb: 2 }} />
          <Typography variant="body1" color="text.secondary">
            Loading demo data...
          </Typography>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom>
          LendPeak2 Demo Showcase
        </Typography>
        <Typography variant="h6" color="text.secondary" gutterBottom>
          Explore comprehensive loan scenarios demonstrating all system capabilities
        </Typography>
        <Alert severity="info" sx={{ mt: 2 }}>
          This showcase contains {allLoans.length} realistic loan scenarios across {Object.keys(DEMO_CATEGORIES).length} categories. 
          All data is generated for demonstration purposes and showcases the full range of LendPeak2 functionality.
        </Alert>
      </Box>

      {renderStatsOverview()}

      <Paper sx={{ width: '100%', mb: 3 }}>
        <Tabs value={selectedTab} onChange={handleTabChange} variant="scrollable" scrollButtons="auto">
          <Tab label="Featured Scenarios" icon={<StarIcon />} />
          <Tab label="All Loans" icon={<BankIcon />} />
          <Tab label="By Category" icon={<AnalyticsIcon />} />
          <Tab label="Data Table" icon={<HistoryIcon />} />
        </Tabs>

        <TabPanel value={selectedTab} index={0}>
          <Typography variant="h5" gutterBottom>
            Featured Demo Scenarios
          </Typography>
          <Typography variant="body1" color="text.secondary" paragraph>
            These scenarios highlight key features and demonstrate various loan types and situations.
          </Typography>
          <Grid container spacing={3}>
            {featuredLoans.map(loan => (
              <Grid item xs={12} sm={6} lg={4} key={loan.id}>
                {renderLoanCard(loan)}
              </Grid>
            ))}
          </Grid>
        </TabPanel>

        <TabPanel value={selectedTab} index={1}>
          <Box sx={{ mb: 3 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Search loans..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={selectedCategory}
                    label="Category"
                    onChange={(e) => setSelectedCategory(e.target.value)}
                  >
                    <MenuItem value="ALL">All Categories</MenuItem>
                    {Object.entries(DEMO_CATEGORIES).map(([key, label]) => (
                      <MenuItem key={key} value={key}>{label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={selectedStatus}
                    label="Status"
                    onChange={(e) => setSelectedStatus(e.target.value)}
                  >
                    <MenuItem value="ALL">All Statuses</MenuItem>
                    <MenuItem value="ACTIVE">Active</MenuItem>
                    <MenuItem value="DELINQUENT">Delinquent</MenuItem>
                    <MenuItem value="PAID_OFF">Paid Off</MenuItem>
                    <MenuItem value="PENDING">Pending</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </Box>

          <Typography variant="h6" gutterBottom>
            {filteredLoans.length} loans found
          </Typography>
          
          <Grid container spacing={3}>
            {filteredLoans.map(loan => (
              <Grid item xs={12} sm={6} lg={4} key={loan.id}>
                {renderLoanCard(loan)}
              </Grid>
            ))}
          </Grid>
        </TabPanel>

        <TabPanel value={selectedTab} index={2}>
          <Typography variant="h5" gutterBottom>
            Loans by Category
          </Typography>
          {Object.entries(loansByCategory).map(([category, loans]) => (
            <Accordion key={category} defaultExpanded={category === 'STANDARD'}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {categoryIcons[category]}
                  <Typography variant="h6">
                    {DEMO_CATEGORIES[category as keyof typeof DEMO_CATEGORIES]} ({loans.length})
                  </Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  {loans.map(loan => (
                    <Grid item xs={12} sm={6} md={4} key={loan.id}>
                      {renderLoanCard(loan)}
                    </Grid>
                  ))}
                </Grid>
              </AccordionDetails>
            </Accordion>
          ))}
        </TabPanel>

        <TabPanel value={selectedTab} index={3}>
          <Typography variant="h5" gutterBottom>
            Loan Data Table
          </Typography>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Loan #</TableCell>
                  <TableCell>Borrower</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell align="right">Principal</TableCell>
                  <TableCell align="right">Balance</TableCell>
                  <TableCell align="right">Rate</TableCell>
                  <TableCell align="right">Payment</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredLoans.map(loan => (
                  <TableRow key={loan.id} hover>
                    <TableCell>{loan.loanNumber}</TableCell>
                    <TableCell>{demoDataService.getBorrowerName(loan.borrowerId)}</TableCell>
                    <TableCell>{loan.scenario.name}</TableCell>
                    <TableCell>
                      <Chip 
                        size="small" 
                        label={DEMO_CATEGORIES[loan.scenario.category as keyof typeof DEMO_CATEGORIES]}
                        color={categoryColors[loan.scenario.category] as any}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="right">{formatCurrency(loan.scenario.loanParameters.principal)}</TableCell>
                    <TableCell align="right">{formatCurrency(loan.currentState.currentBalance)}</TableCell>
                    <TableCell align="right">{formatPercentage(loan.scenario.loanParameters.interestRate)}</TableCell>
                    <TableCell align="right">{formatCurrency(loan.currentState.monthlyPayment)}</TableCell>
                    <TableCell>
                      <Chip 
                        size="small" 
                        label={loan.currentState.status.replace('_', ' ')}
                        color={getStatusColor(loan.currentState.status) as any}
                      />
                    </TableCell>
                    <TableCell>
                      <Button size="small" onClick={() => handleLoanClick(loan)}>
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>
      </Paper>

      {/* Loan Detail Dialog */}
      <Dialog 
        open={detailDialogOpen} 
        onClose={() => setDetailDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        {selectedLoan && (
          <>
            <DialogTitle>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {getLoanTypeIcon(selectedLoan.scenario.name)}
                <Typography variant="h6">
                  {selectedLoan.scenario.name}
                </Typography>
                <Chip 
                  label={DEMO_CATEGORIES[selectedLoan.scenario.category as keyof typeof DEMO_CATEGORIES]}
                  size="small"
                  color={categoryColors[selectedLoan.scenario.category] as any}
                />
              </Box>
            </DialogTitle>
            <DialogContent>
              <Typography variant="body1" paragraph>
                {selectedLoan.scenario.description}
              </Typography>
              
              <Divider sx={{ my: 2 }} />
              
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="h6" gutterBottom>
                    Loan Details
                  </Typography>
                  <List dense>
                    <ListItem>
                      <ListItemText 
                        primary="Loan Number" 
                        secondary={selectedLoan.loanNumber} 
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText 
                        primary="Borrower" 
                        secondary={demoDataService.getBorrowerName(selectedLoan.borrowerId)} 
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText 
                        primary="Original Amount" 
                        secondary={formatCurrency(selectedLoan.scenario.loanParameters.principal)} 
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText 
                        primary="Current Balance" 
                        secondary={formatCurrency(selectedLoan.currentState.currentBalance)} 
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText 
                        primary="Interest Rate" 
                        secondary={formatPercentage(selectedLoan.scenario.loanParameters.interestRate)} 
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText 
                        primary="Monthly Payment" 
                        secondary={formatCurrency(selectedLoan.currentState.monthlyPayment)} 
                      />
                    </ListItem>
                  </List>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <Typography variant="h6" gutterBottom>
                    Special Features
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {selectedLoan.scenario.specialFeatures?.map((feature, index) => (
                      <Chip 
                        key={index}
                        label={feature} 
                        size="small"
                        variant="outlined"
                      />
                    )) || <Typography variant="body2" color="text.secondary">No special features</Typography>}
                  </Box>
                  
                  {selectedLoan.scenario.modifications && selectedLoan.scenario.modifications.length > 0 && (
                    <>
                      <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                        Modifications
                      </Typography>
                      {selectedLoan.scenario.modifications.map((mod, index) => (
                        <Card key={index} variant="outlined" sx={{ mb: 1 }}>
                          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                            <Typography variant="subtitle2">
                              {mod.type.replace('_', ' ')}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {mod.reason}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {mod.date.toLocaleDateString()}
                            </Typography>
                          </CardContent>
                        </Card>
                      ))}
                    </>
                  )}
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDetailDialogOpen(false)}>
                Close
              </Button>
              <Button 
                onClick={() => {
                  setDetailDialogOpen(false);
                  handleViewLoan(selectedLoan.id);
                }}
                variant="contained"
              >
                View Full Details
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Container>
  );
}