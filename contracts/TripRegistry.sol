// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./CompanyRegistry.sol";

contract TripRegistry {
    CompanyRegistry public companyRegistry;

    struct Trip {
        uint256 id;
        address companyAddress;
        address[] participants; // Users on this trip
        string destination;
        uint256 startDate;
        uint256 endDate;
        uint256 budget;
        bool isActive;
    }

    mapping(uint256 => Trip) public trips;
    mapping(address => uint256[] ) public companyTrips;

    uint256 private tripCounter;

    event TripCreated(uint256 indexed tripId, address indexed company, string destination, uint256 startDate, uint256 endDate);

    modifier onlyRegisteredCompany() {
        require(companyRegistry.isRegisteredCompany(msg.sender), "Caller is not a registered company");
        _;
    }

    constructor(address _companyRegistry) {
        companyRegistry = CompanyRegistry(_companyRegistry);
        tripCounter = 0;
    }

    function createTrip(
        address[] memory _participants,
        string memory _destination,
        uint256 _startDate,
        uint256 _endDate,
        uint256 _budget
    ) external onlyRegisteredCompany returns (uint256) {
        require(_participants.length > 0, "Trip must have participants");
        require(_startDate <= _endDate, "Start date must be before or on end date");

        tripCounter++;
        uint256 currentTripId = tripCounter;

        trips[currentTripId] = Trip({
            id: currentTripId,
            companyAddress: msg.sender,
            participants: _participants,
            destination: _destination,
            startDate: _startDate,
            endDate: _endDate,
            budget: _budget,
            isActive: true
        });

        companyTrips[msg.sender].push(currentTripId);

        emit TripCreated(currentTripId, msg.sender, _destination, _startDate, _endDate);

        return currentTripId;
    }

    function getTrip(uint256 _tripId) external view returns (
        uint256 id,
        address companyAddress,
        address[] memory participants,
        string memory destination,
        uint256 startDate,
        uint256 endDate,
        uint256 budget,
        bool isActive
    ) {
        Trip storage trip = trips[_tripId];
        require(trip.id != 0, "Trip does not exist");

        return (
            trip.id,
            trip.companyAddress,
            trip.participants,
            trip.destination,
            trip.startDate,
            trip.endDate,
            trip.budget,
            trip.isActive
        );
    }

    function getCompanyTrips(address _companyAddress) external view returns (uint256[] memory) {
        return companyTrips[_companyAddress];
    }
} 